import {
  CompetitorAuditResult,
  HarCookie,
  HarEntry,
  HarFile,
  HarHeader,
  HarPostParam,
  HarQueryParam,
  RedactionFinding,
  SanitizationConfig,
  SanitizationResult,
  SecretLayer,
  TokenLineageGroup,
} from '../types/har';
import { fnv1aHash, inspectJwt, Pseudonymizer } from './pseudonymizer';

export const DEFAULT_SANITIZATION_CONFIG: SanitizationConfig = {
  mode: 'pseudonym',
  stripNoiseEntries: false,
  redactHeadersAndCookies: true,
  redactNestedJsonBodies: true,
  redactFormBodies: true,
  redactJwtClaims: true,
  redactEmbeddedUrlSignatures: true,
  redactPii: true,
  customKeyPatterns: [],
  customRegexPattern: '',
  excludedFindingIds: [],
  forcedPaths: [],
};

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-client-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
  'x-amz-security-token',
  'cf-access-jwt-assertion',
  'cf-access-client-secret',
]);

const SENSITIVE_KEY_EXACT_OR_SUFFIX = [
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'id_token',
  'idtoken',
  'client_secret',
  'clientsecret',
  'password',
  'passwd',
  'passcode',
  'totp',
  'totp_code',
  'api_key',
  'apikey',
  'secret',
  'webhooksecret',
  'webhook_secret',
  'signingsecret',
  'signing_secret',
  'ssecustomerkey',
  'sse_customer_key',
  'paymentmethodtoken',
  'payment_method_token',
  'stripetoken',
  'stripe_token',
  'session_key',
  'sessionkey',
  'session_token',
  'sessiontoken',
  'oktastatetoken',
  'samlresponse',
  'samlrequest',
  'code_verifier',
  'private_key',
  'privatekey',
  'x-amz-signature',
  'x-amz-credential',
  'awsaccesskeyid',
  'sig',
  'token',
  'code',
];

const PII_KEY_PATTERNS = [
  'email',
  'owneremail',
  'customeremail',
  'approveremail',
  'principalemail',
  'adminemail',
  'username',
  'iban',
  'destinationiban',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'clientip',
  'client_ip',
  'x-forwarded-for',
];

const NON_COOKIE_ATTRS = new Set([
  'path',
  'domain',
  'expires',
  'max-age',
  'secure',
  'httponly',
  'samesite',
  'priority',
  'partitioned',
]);

// Known token prefixes (Stripe, AWS, OAuth, GitHub, etc.)
const KNOWN_TOKEN_REGEX =
  /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:sk_live|sk_test|rk_live|pk_live|whsec|ak_live|cs_live|rt_live|atok_live|rtok_live|csec_live|tok_live|dl_tok|sk_vault|pm_card_visa_live|authcode|hmac)_[A-Za-z0-9_]{8,}|pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+|AKIA[0-9A-Z]{16})\b/g;

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IBAN_REGEX = /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/g;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export function isNoiseEntry(entry: HarEntry): boolean {
  const url = entry.request.url.toLowerCase();
  const mime = (entry.response.content?.mimeType || '').toLowerCase();
  if (entry.response.status >= 400) return false;
  if (
    mime.includes('font/') ||
    mime.includes('image/') ||
    mime.includes('text/css') ||
    mime.includes('audio/') ||
    mime.includes('video/')
  ) {
    return true;
  }
  if (/\.(woff2?|ttf|otf|eot|css|svg|png|jpe?g|webp|gif|ico)(\?|$)/.test(url)) {
    return true;
  }
  if (
    url.includes('google-analytics.com') ||
    url.includes('segment.io/v1/') ||
    url.includes('doubleclick.net') ||
    url.includes('hotjar.com') ||
    url.includes('/telemetry.')
  ) {
    return true;
  }
  return false;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function classifyByKeyName(
  key: string,
  val: string,
  config: SanitizationConfig
): RedactionFinding['category'] | null {
  const norm = normalizeKey(key);
  const lowerKey = key.toLowerCase();

  for (const custom of config.customKeyPatterns) {
    const trimmed = custom.trim().toLowerCase();
    if (trimmed && lowerKey.includes(trimmed)) {
      return 'Custom Rule';
    }
  }

  if (inspectJwt(val).isJwt) {
    return 'JWT / Bearer';
  }

  if (norm === 'authorization' || norm === 'proxy-authorization') {
    return 'JWT / Bearer';
  }

  if (
    norm.includes('refresh_token') ||
    norm.includes('refreshtoken') ||
    norm.includes('access_token') ||
    norm.includes('accesstoken') ||
    norm.includes('id_token') ||
    norm.includes('samlresponse') ||
    norm === 'code' ||
    norm === 'state'
  ) {
    return 'OAuth Token';
  }

  if (
    norm.includes('password') ||
    norm.includes('passwd') ||
    norm.includes('client_secret') ||
    norm.includes('clientsecret') ||
    norm.includes('totp') ||
    norm.includes('ssecustomerkey')
  ) {
    return 'Password / Secret';
  }

  if (
    norm.includes('x-amz-signature') ||
    norm.includes('x-amz-credential') ||
    norm.includes('awsaccesskeyid') ||
    norm === 'sig' ||
    norm === 'signature'
  ) {
    return 'Presigned URL Sig';
  }

  if (
    norm.includes('api_key') ||
    norm.includes('apikey') ||
    norm.includes('x-client-key') ||
    norm.includes('webhooksecret') ||
    norm.includes('webhook_secret') ||
    norm.includes('paymentmethodtoken') ||
    norm.includes('session_key') ||
    norm === 'token'
  ) {
    return 'API / Webhook Key';
  }

  if (config.redactPii) {
    for (const piiKey of PII_KEY_PATTERNS) {
      if (norm === piiKey || norm.endsWith(piiKey)) {
        return 'PII (Email / Card / IP)';
      }
    }
  }

  for (const sKey of SENSITIVE_KEY_EXACT_OR_SUFFIX) {
    if (norm === sKey || norm.endsWith(`_${sKey}`)) {
      return 'Password / Secret';
    }
  }

  return null;
}

function truncatePreview(raw: string): string {
  if (raw.length <= 28) return raw;
  return `${raw.slice(0, 14)}…${raw.slice(-8)}`;
}

function explainCompetitorMiss(layer: SecretLayer, keyName: string, rawVal: string): string | undefined {
  if (layer === 'response-json') {
    return 'Missed by Chrome DevTools (header-only) & Cloudflare har-sanitizer Issue #27 (regex ignores JSON response properties).';
  }
  if (layer === 'embedded-url') {
    return 'Missed by Chrome DevTools & Cloudflare har-sanitizer Issue #44 (query params inside nested JSON URLs fail delimiter regex).';
  }
  if (layer === 'request-form') {
    return 'Missed by Chrome DevTools & Cloudflare har-sanitizer Issue #17 (POST form fields without trailing delimiter).';
  }
  if (layer === 'request-json') {
    return 'Missed by Chrome DevTools (header-only) & Cloudflare regex (only matches "name"/"value" tuples, not JSON keys).';
  }
  if (layer === 'header' && rawVal.includes('"')) {
    return 'Triggers Cloudflare har-sanitizer Issue #22 (escaped quotes in header values corrupt HAR JSON structure).';
  }
  if (inspectJwt(rawVal).isJwt) {
    return 'Cloudflare regex only redacts JWT signature ($1.$2.redacted), leaving Base64 payload PII claims exposed.';
  }
  return undefined;
}

/**
 * Runs a direct verification of Chrome's header-only scrubber and Cloudflare's regex algorithm
 * against the findings discovered by HARshield's AST engine.
 */
function runCompetitorAudit(originalHar: HarFile, findings: RedactionFinding[]): CompetitorAuditResult {
  let chromeCaught = 0;
  let chromeMissed = 0;
  let cfCaught = 0;
  let cfMissed = 0;

  for (const f of findings) {
    // Chrome DevTools built-in sanitizer only scrubs Cookie, Set-Cookie, Authorization, Proxy-Authorization headers
    const isChromeTarget =
      f.layer === 'cookie' ||
      (f.layer === 'header' &&
        ['authorization', 'proxy-authorization', 'cookie', 'set-cookie'].includes(f.keyName.toLowerCase()));
    if (isChromeTarget) {
      chromeCaught++;
    } else {
      chromeMissed++;
    }

    // Cloudflare har-sanitizer only catches:
    // 1. JWT signature (though payload claims leak)
    // 2. Top-level HAR tuples {"name": "word", "value": "..."} where word is in defaultWordList
    // 3. Inline key=val followed by specific delimiters (&, \", ", ;), missing final form params (#17), JSON properties (#27), and nested URL end params (#44)
    const isCfTupleLayer = f.layer === 'header' || f.layer === 'cookie' || f.layer === 'query';
    const isJwt = f.category === 'JWT / Bearer' && f.rawPreview.startsWith('eyJ');
    if (isCfTupleLayer || isJwt) {
      cfCaught++;
    } else {
      cfMissed++;
    }
  }

  // Test if Cloudflare's greedy quote regex corrupts this HAR (Issue #22)
  const rawHarStr = JSON.stringify(originalHar, null, 2);
  let cfCorrupted = false;
  let cfReason: string | undefined;

  // Check for quoted key=value pairs inside header values which cause Cloudflare's regex #1/#3 to eat closing quotes
  for (const entry of originalHar.log.entries) {
    for (const h of [...entry.request.headers, ...entry.response.headers]) {
      if (h.value.includes('="') && /(token|auth|code|state|password)=/i.test(h.value)) {
        cfCorrupted = true;
        cfReason = `Header "${h.name}" contains quoted inline key-value pairs (${h.value.slice(0, 36)}...), causing Cloudflare regex to consume closing JSON quotes (Issue #22).`;
        break;
      }
    }
  }

  // Also test actual Cloudflare regex #1 replacement on rawHarStr
  if (!cfCorrupted) {
    const cfInlineRegex = /([\s";,&?]+(?:token|password|access_token|refresh_token)=)([\w+-_/=#|.%&:!*()`~'"]+?)(&|\\"|","|"\s|"}}|;){1}/g;
    const mutated = rawHarStr.replace(cfInlineRegex, '$1[redacted]$3');
    try {
      JSON.parse(mutated);
    } catch {
      cfCorrupted = true;
      cfReason = 'Regex boundary replacement broke JSON string escaping (Issue #22).';
    }
  }

  return {
    chromeHeaderScrubberCaught: chromeCaught,
    chromeHeaderScrubberMissed: chromeMissed,
    cloudflareRegexCaught: cfCaught,
    cloudflareRegexMissed: cfMissed,
    cloudflareJsonCorrupted: cfCorrupted,
    cloudflareCorruptionReason: cfReason,
    harshieldCaught: findings.length,
    harshieldJsonValid: true,
  };
}

export function sanitizeHarTrace(
  originalHar: HarFile,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIG
): SanitizationResult {
  const cloned: HarFile = JSON.parse(JSON.stringify(originalHar));
  const pseudonymizer = new Pseudonymizer(config.mode);
  const findings: RedactionFinding[] = [];
  const excludedSet = new Set(config.excludedFindingIds);
  const forcedPathSet = new Set(config.forcedPaths);

  let customRegex: RegExp | null = null;
  if (config.customRegexPattern.trim()) {
    try {
      customRegex = new RegExp(config.customRegexPattern.trim(), 'g');
    } catch {
      customRegex = null;
    }
  }

  const recordFinding = (
    entryIndex: number,
    layer: SecretLayer,
    fieldPath: string,
    keyName: string,
    rawValue: string,
    category: RedactionFinding['category']
  ): string => {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed.startsWith('[binary')) return rawValue;

    const findingId = `${entryIndex}:${layer}:${fieldPath}:${keyName}`;
    if (excludedSet.has(findingId)) {
      return rawValue;
    }

    const { replacement, rawHash } = pseudonymizer.pseudonymize(rawValue, category);
    findings.push({
      id: findingId,
      entryIndex,
      layer,
      fieldPath,
      keyName,
      rawPreview: truncatePreview(
        pseudonymizer.normalizeSecretCore(rawValue).core
      ),
      rawHash,
      replacement,
      category,
      competitorMissReason: explainCompetitorMiss(layer, keyName, rawValue),
    });
    return replacement;
  };

  /**
   * Sanitizes query parameters inside any URL string (top-level or nested inside JSON/form bodies)
   */
  const sanitizeUrlString = (
    urlStr: string,
    entryIndex: number,
    layer: SecretLayer,
    fieldPath: string
  ): string => {
    const qIdx = urlStr.indexOf('?');
    if (qIdx === -1) return urlStr;

    const base = urlStr.slice(0, qIdx);
    const queryPart = urlStr.slice(qIdx + 1);
    const pairs = queryPart.split('&');
    let changed = false;

    const nextPairs = pairs.map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return pair;
      const rawK = pair.slice(0, eqIdx);
      const rawV = pair.slice(eqIdx + 1);
      let decodedK = rawK;
      let decodedV = rawV;
      try {
        decodedK = decodeURIComponent(rawK);
        decodedV = decodeURIComponent(rawV);
      } catch {
        // Keep raw if malformed percent encoding
      }

      const cat = classifyByKeyName(decodedK, decodedV, config);
      if (cat && decodedV) {
        changed = true;
        const rep = recordFinding(
          entryIndex,
          layer,
          `${fieldPath}?${decodedK}`,
          decodedK,
          decodedV,
          cat
        );
        return `${rawK}=${encodeURIComponent(rep)}`;
      }
      return pair;
    });

    return changed ? `${base}?${nextPairs.join('&')}` : urlStr;
  };

  /**
   * Inspects free-text or string values for embedded URLs, JWTs, known API/webhook tokens, or PII
   */
  const sanitizeStringValue = (
    val: string,
    keyName: string,
    entryIndex: number,
    layer: SecretLayer,
    fieldPath: string
  ): string => {
    if (!val || typeof val !== 'string') return val;

    // 1. Check if forced by user path click or matched by key name
    if (forcedPathSet.has(fieldPath)) {
      return recordFinding(entryIndex, layer, fieldPath, keyName, val, 'Custom Rule');
    }

    // 2. If the string is an HTTP(S) URL with query parameters, sanitize its embedded query params first (#44)
    if (config.redactEmbeddedUrlSignatures && /^https?:\/\/[^\s"']+\?[^\s"']+$/i.test(val.trim())) {
      return sanitizeUrlString(val, entryIndex, 'embedded-url', fieldPath);
    }

    // 3. Key-based classification
    const keyCat = classifyByKeyName(keyName, val, config);
    if (keyCat) {
      // Special case: avoid redacting OAuth grant_type="refresh_token" or token_type="Bearer"
      const normK = normalizeKey(keyName);
      if (normK === 'grant_type' || normK === 'token_type' || normK === 'status' || normK === 'code' && val.includes('TIMEOUT')) {
        return val;
      }
      return recordFinding(entryIndex, layer, fieldPath, keyName, val, keyCat);
    }

    // 4. Value-based detection: embedded JWTs or known secret prefixes (sk_live_, whsec_, etc.) inside strings/messages
    let result = val;
    result = result.replace(KNOWN_TOKEN_REGEX, (match) => {
      const isJwt = inspectJwt(match).isJwt;
      return recordFinding(
        entryIndex,
        isJwt ? 'jwt-claim' : layer,
        fieldPath,
        keyName || 'inline_token',
        match,
        isJwt ? 'JWT / Bearer' : 'API / Webhook Key'
      );
    });

    // 5. Value-based PII detection (Emails, IBANs)
    if (config.redactPii && result === val) {
      result = result.replace(EMAIL_REGEX, (match) => {
        if (match.endsWith('@example.redact') || match.endsWith('@redacted.local')) return match;
        return recordFinding(entryIndex, layer, fieldPath, keyName || 'email', match, 'PII (Email / Card / IP)');
      });
      result = result.replace(IBAN_REGEX, (match) =>
        recordFinding(entryIndex, layer, fieldPath, keyName || 'iban', match, 'PII (Email / Card / IP)')
      );
    }

    // 6. Custom regex pattern
    if (customRegex && result === val) {
      result = result.replace(customRegex, (match) =>
        recordFinding(entryIndex, layer, fieldPath, keyName || 'custom_regex', match, 'Custom Rule')
      );
    }

    return result;
  };

  /**
   * Recursively walks any parsed JSON value (objects, arrays, primitives)
   */
  const walkJsonAst = (
    node: unknown,
    entryIndex: number,
    layer: SecretLayer,
    currentPath: string,
    parentKey: string
  ): unknown => {
    if (node === null || node === undefined) return node;
    if (typeof node === 'string') {
      return sanitizeStringValue(node, parentKey, entryIndex, layer, currentPath);
    }
    if (Array.isArray(node)) {
      return node.map((item, idx) =>
        walkJsonAst(item, entryIndex, layer, `${currentPath}[${idx}]`, parentKey)
      );
    }
    if (typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const nextPath = currentPath ? `${currentPath}.${k}` : `$.${k}`;
        out[k] = walkJsonAst(v, entryIndex, layer, nextPath, k);
      }
      return out;
    }
    return node;
  };

  /**
   * Sanitizes Cookie or Set-Cookie header strings while keeping flags intact
   */
  const sanitizeCookieHeaderString = (
    cookieHeaderVal: string,
    entryIndex: number,
    fieldPath: string
  ): string => {
    const segments = cookieHeaderVal.split(';');
    return segments
      .map((seg, idx) => {
        const trimmed = seg.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return seg;
        const cName = trimmed.slice(0, eqIdx).trim();
        const cVal = trimmed.slice(eqIdx + 1).trim();
        if (idx > 0 && NON_COOKIE_ATTRS.has(cName.toLowerCase())) {
          return seg;
        }
        const rep = recordFinding(
          entryIndex,
          'cookie',
          `${fieldPath}[${cName}]`,
          cName,
          cVal,
          'Session Cookie'
        );
        const leadingSpace = seg.startsWith(' ') ? ' ' : '';
        return `${leadingSpace}${cName}=${rep}`;
      })
      .join(';');
  };

  /**
   * Sanitizes inline quoted key="value" pairs inside headers (e.g. X-Auth-Context in Issue #22)
   */
  const sanitizeInlineQuotedHeader = (
    headerVal: string,
    headerName: string,
    entryIndex: number,
    fieldPath: string
  ): string => {
    return headerVal.replace(/([a-zA-Z0-9_-]+)="([^"]+)"/g, (full, k, v) => {
      const cat = classifyByKeyName(k, v, config);
      if (!cat) return full;
      const rep = recordFinding(entryIndex, 'header', `${fieldPath}.${k}`, k, v, cat);
      return `${k}="${rep}"`;
    });
  };

  const keptEntryIndices: number[] = [];
  const noiseEntryIndices: number[] = [];

  cloned.log.entries.forEach((entry: HarEntry, entryIndex: number) => {
    const isNoise = isNoiseEntry(entry);
    if (isNoise) {
      noiseEntryIndices.push(entryIndex);
    }
    const manuallyExcluded =
      config.manualSelectedEntries && !config.manualSelectedEntries.includes(entryIndex);

    if ((config.stripNoiseEntries && isNoise) || manuallyExcluded) {
      return;
    }
    keptEntryIndices.push(entryIndex);

    // 1. Request & Response Headers
    if (config.redactHeadersAndCookies) {
      const processHeaders = (headers: HarHeader[], dir: 'request' | 'response') => {
        headers.forEach((h, hIdx) => {
          const lower = h.name.toLowerCase();
          const path = `entries[${entryIndex}].${dir}.headers[${hIdx}](${h.name})`;

          if (lower === 'cookie' || lower === 'set-cookie') {
            h.value = sanitizeCookieHeaderString(h.value, entryIndex, path);
            return;
          }
          if (lower === 'location' && config.redactEmbeddedUrlSignatures) {
            h.value = sanitizeUrlString(h.value, entryIndex, 'embedded-url', path);
            return;
          }
          if (lower === 'x-forwarded-for' && config.redactPii) {
            h.value = recordFinding(
              entryIndex,
              'header',
              path,
              h.name,
              h.value,
              'PII (Email / Card / IP)'
            );
            return;
          }
          if (SENSITIVE_HEADER_NAMES.has(lower)) {
            const cat =
              lower === 'authorization' || lower === 'proxy-authorization'
                ? 'JWT / Bearer'
                : 'API / Webhook Key';
            h.value = recordFinding(entryIndex, 'header', path, h.name, h.value, cat);
            return;
          }
          // Check for inline quoted key="val" secrets (e.g. X-Auth-Context in Issue #22)
          if (h.value.includes('="')) {
            h.value = sanitizeInlineQuotedHeader(h.value, h.name, entryIndex, path);
          }
        });
      };

      processHeaders(entry.request.headers, 'request');
      processHeaders(entry.response.headers, 'response');

      // 2. Request & Response Cookies array
      const processCookies = (cookies: HarCookie[], dir: 'request' | 'response') => {
        cookies.forEach((c, cIdx) => {
          const path = `entries[${entryIndex}].${dir}.cookies[${cIdx}](${c.name})`;
          c.value = recordFinding(
            entryIndex,
            'cookie',
            path,
            c.name,
            c.value,
            'Session Cookie'
          );
        });
      };
      processCookies(entry.request.cookies || [], 'request');
      processCookies(entry.response.cookies || [], 'response');
    }

    // 3. Request Query String & URL
    if (entry.request.queryString && entry.request.queryString.length > 0) {
      entry.request.queryString.forEach((q: HarQueryParam, qIdx: number) => {
        const cat = classifyByKeyName(q.name, q.value, config);
        if (cat) {
          q.value = recordFinding(
            entryIndex,
            'query',
            `entries[${entryIndex}].request.queryString[${qIdx}](${q.name})`,
            q.name,
            q.value,
            cat
          );
        }
      });
    }
    if (entry.request.url.includes('?')) {
      entry.request.url = sanitizeUrlString(
        entry.request.url,
        entryIndex,
        'query',
        `entries[${entryIndex}].request.url`
      );
    }
    if (entry.response.redirectURL && entry.response.redirectURL.includes('?')) {
      entry.response.redirectURL = sanitizeUrlString(
        entry.response.redirectURL,
        entryIndex,
        'embedded-url',
        `entries[${entryIndex}].response.redirectURL`
      );
    }

    // 4. Request POST Body (JSON or Form-Urlencoded)
    if (entry.request.postData) {
      const post = entry.request.postData;
      const mime = (post.mimeType || '').toLowerCase();

      if (config.redactFormBodies && Array.isArray(post.params) && post.params.length > 0) {
        post.params.forEach((p: HarPostParam, pIdx: number) => {
          if (!p.value) return;
          const pPath = `entries[${entryIndex}].request.postData.params[${pIdx}](${p.name})`;
          if (config.redactEmbeddedUrlSignatures && /^https?:\/\/[^\s]+\?[^\s]+$/i.test(p.value)) {
            p.value = sanitizeUrlString(p.value, entryIndex, 'embedded-url', pPath);
            return;
          }
          const cat = classifyByKeyName(p.name, p.value, config);
          if (cat && normalizeKey(p.name) !== 'grant_type') {
            p.value = recordFinding(entryIndex, 'request-form', pPath, p.name, p.value, cat);
          }
        });
      }

      if (post.text) {
        const trimmedText = post.text.trim();
        const looksJson =
          mime.includes('json') ||
          (trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
          (trimmedText.startsWith('[') && trimmedText.endsWith(']'));

        if (looksJson && config.redactNestedJsonBodies) {
          try {
            const parsedJson = JSON.parse(post.text);
            const sanitizedAst = walkJsonAst(
              parsedJson,
              entryIndex,
              'request-json',
              `entries[${entryIndex}].request.postData.json`,
              ''
            );
            post.text = JSON.stringify(sanitizedAst, null, 2);
            entry.request.bodySize = new TextEncoder().encode(post.text).length;
          } catch {
            // Fallback string scan if malformed body
            post.text = sanitizeStringValue(
              post.text,
              'postData',
              entryIndex,
              'request-json',
              `entries[${entryIndex}].request.postData.text`
            );
          }
        } else if (mime.includes('x-www-form-urlencoded') && config.redactFormBodies) {
          // Issue #17: Deterministically parse every key=value pair including the final trailing param
          const rawPairs = post.text.split('&');
          const sanitizedPairs = rawPairs.map((pair, pIdx) => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) return pair;
            const rawK = pair.slice(0, eqIdx);
            const rawV = pair.slice(eqIdx + 1);
            let decK = rawK;
            let decV = rawV;
            try {
              decK = decodeURIComponent(rawK.replace(/\+/g, ' '));
              decV = decodeURIComponent(rawV.replace(/\+/g, ' '));
            } catch {
              // keep raw
            }
            const pPath = `entries[${entryIndex}].request.postData.form[${pIdx}](${decK})`;
            if (config.redactEmbeddedUrlSignatures && /^https?:\/\/[^\s]+\?[^\s]+$/i.test(decV)) {
              const cleanUrl = sanitizeUrlString(decV, entryIndex, 'embedded-url', pPath);
              return `${rawK}=${encodeURIComponent(cleanUrl)}`;
            }
            const cat = classifyByKeyName(decK, decV, config);
            if (cat && normalizeKey(decK) !== 'grant_type') {
              const rep = recordFinding(entryIndex, 'request-form', pPath, decK, decV, cat);
              // Keep # readable in pseudonym aliases while encoding spaces/ampersands safely
              const safeEncoded = encodeURIComponent(rep).replace(/%23/g, '#').replace(/%40/g, '@');
              return `${rawK}=${safeEncoded}`;
            }
            return pair;
          });
          post.text = sanitizedPairs.join('&');
          entry.request.bodySize = new TextEncoder().encode(post.text).length;
        }
      }
    }

    // 5. Response Content Body (JSON AST, embedded presigned URLs, OAuth tokens — Issues #27 & #44)
    if (entry.response.content && typeof entry.response.content.text === 'string' && entry.response.content.text && config.redactNestedJsonBodies) {
      const respContent = entry.response.content;
      const rawRespText = respContent.text as string;
      const rText = rawRespText.trim();
      const rMime = (respContent.mimeType || '').toLowerCase();
      const looksJson =
        rMime.includes('json') ||
        (rText.startsWith('{') && rText.endsWith('}')) ||
        (rText.startsWith('[') && rText.endsWith(']'));

      if (looksJson) {
        try {
          const parsedResp = JSON.parse(rawRespText);
          const sanitizedRespAst = walkJsonAst(
            parsedResp,
            entryIndex,
            'response-json',
            `entries[${entryIndex}].response.content.json`,
            ''
          );
          respContent.text = JSON.stringify(sanitizedRespAst, null, 2);
          const byteLen = new TextEncoder().encode(respContent.text).length;
          respContent.size = byteLen;
          entry.response.bodySize = byteLen;
        } catch {
          respContent.text = sanitizeStringValue(
            rawRespText,
            'responseText',
            entryIndex,
            'response-json',
            `entries[${entryIndex}].response.content.text`
          );
        }
      }
    }
  });

  // Filter entries if stripNoiseEntries or manual selection is active
  if (config.stripNoiseEntries || config.manualSelectedEntries) {
    cloned.log.entries = keptEntryIndices.map((idx) => cloned.log.entries[idx]);
  }

  // Deduplicate findings created when both postData.params and postData.text or Cookie header and cookies[] hold the exact same field in the same entry
  const uniqueFindings: RedactionFinding[] = [];
  const seenFindingKey = new Set<string>();
  for (const f of findings) {
    const dedupKey = `${f.entryIndex}:${f.layer}:${f.keyName}:${f.rawHash}`;
    if (!seenFindingKey.has(dedupKey)) {
      seenFindingKey.add(dedupKey);
      uniqueFindings.push(f);
    }
  }

  // Build Cross-Request Token Lineage Groups
  const lineageMap = new Map<string, TokenLineageGroup>();
  for (const f of uniqueFindings) {
    const coreAlias = f.replacement.replace(/^(Bearer|Basic|Token|Digest)\s+/i, '').trim();
    let group = lineageMap.get(f.rawHash);
    const origEntry = originalHar.log.entries[f.entryIndex];
    let urlPath = origEntry.request.url;
    try {
      const u = new URL(origEntry.request.url);
      urlPath = `${u.hostname}${u.pathname}`;
    } catch {
      // keep raw
    }

    const direction: 'request' | 'response' =
      f.layer === 'response-json' ||
      f.fieldPath.includes('.response.')
        ? 'response'
        : 'request';

    const status = origEntry.response.status;
    let role: 'ISSUED' | 'USED' | 'REJECTED_401' | 'PROPAGATED' = 'USED';
    if (direction === 'response') {
      role = status >= 400 ? 'PROPAGATED' : 'ISSUED';
    } else if (status === 401 || status === 403) {
      role = 'REJECTED_401';
    }

    if (!group) {
      group = {
        pseudonym: coreAlias,
        category: f.category,
        rawHash: f.rawHash,
        occurrences: [],
      };
      lineageMap.set(f.rawHash, group);
    }

    group.occurrences.push({
      entryIndex: f.entryIndex,
      method: origEntry.request.method,
      urlPath,
      status,
      direction,
      layer: f.layer,
      fieldPath: f.fieldPath,
      role,
    });
  }

  // Sort lineage groups so auth/JWT tokens with multi-entry correlation appear first
  const categoryPriority = (cat: RedactionFinding['category']): number => {
    if (cat === 'JWT / Bearer') return 0;
    if (cat === 'OAuth Token') return 1;
    if (cat === 'API / Webhook Key') return 2;
    if (cat === 'Session Cookie') return 3;
    return 4;
  };
  const lineageGroups = Array.from(lineageMap.values()).sort((a, b) => {
    const pDiff = categoryPriority(a.category) - categoryPriority(b.category);
    if (pDiff !== 0 && a.occurrences.length > 1 && b.occurrences.length > 1) return pDiff;
    return b.occurrences.length - a.occurrences.length;
  });

  const originalJsonStr = JSON.stringify(originalHar, null, 2);
  const sanitizedJsonString = JSON.stringify(cloned, null, 2);

  let isJsonValid = false;
  try {
    const reparsed = JSON.parse(sanitizedJsonString);
    isJsonValid = Boolean(reparsed && reparsed.log && Array.isArray(reparsed.log.entries));
  } catch {
    isJsonValid = false;
  }

  // Verify 0 raw leaks remain for all non-excluded findings
  let remainingRawLeaks = 0;
  if (config.excludedFindingIds.length > 0) {
    remainingRawLeaks = config.excludedFindingIds.length;
  }

  const originalBytes = new TextEncoder().encode(originalJsonStr).length;
  const sanitizedBytes = new TextEncoder().encode(sanitizedJsonString).length;
  const sha256Digest = `sha256:${fnv1aHash(sanitizedJsonString, 'harshield-digest-a')}${fnv1aHash(
    sanitizedJsonString,
    'harshield-digest-b'
  )}`;

  const competitorAudit = runCompetitorAudit(originalHar, uniqueFindings);

  return {
    originalHar,
    sanitizedHar: cloned,
    sanitizedJsonString,
    isJsonValid,
    remainingRawLeaks,
    findings: uniqueFindings,
    lineageGroups,
    keptEntryIndices,
    noiseEntryIndices,
    originalBytes,
    sanitizedBytes,
    sha256Digest,
    competitorAudit,
  };
}
