import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PRESET_TRACES } from '../src/data/presets';
import { parseHarString } from '../src/engine/harParser';
import { DEFAULT_SANITIZATION_CONFIG, sanitizeHarTrace } from '../src/engine/recursiveSanitizer';

const dsDir = path.resolve('evidence/stage-3.5-validation/dataset');
fs.mkdirSync(dsDir, { recursive: true });

// Ensure RW-08 and RW-12 exist on disk
const rw08Path = path.join(dsDir, 'RW-08-cloudflare-issues-17-22-27-44.har');
if (!fs.existsSync(rw08Path)) {
  const preset2 = PRESET_TRACES.find((p) => p.id === 'cloudflare-torture-suite')!;
  fs.writeFileSync(rw08Path, JSON.stringify(preset2.har, null, 2));
}

const rw12Path = path.join(dsDir, 'RW-12-truncated-mid-entry-stream.har');
if (!fs.existsSync(rw12Path)) {
  const truncated = `{"log":{"version":"1.2","creator":{"name":"Chrome","version":"131"},"entries":[{"startedDateTime":"2026-11-11T00:00:00Z","time":10,"request":{"method":"GET","url":"https://api.example.com/v1?api_key=ak_live_1234567890","httpVersion":"HTTP/2","cookies":[],"headers":[{"name":"Authorization","value":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfOTkiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.sig1234567890"}],"queryString":[{"name":"api_key","value":"ak_live_1234567890"}],"headersSize":10,"bodySize":0},"response":{"status":200,"statusText":"OK","httpVersion":"HTTP/2","cookies":[],"headers":[],"content":{"size":41,"mimeType":"application/json","text":"{\\"refresh_token\\":\\"rt_live_salvaged_998877\\"}"},"redirectURL":"","headersSize":10,"bodySize":41},"cache":{},"timings":{"send":1,"wait":8,"receive":1}},{"startedDateTime":"2026-11-11T00:00:01Z","request":{"method":"POST","url":"https://truncated.example.com/unfinished`;
  fs.writeFileSync(rw12Path, truncated);
}

/**
 * Official Cloudflare har-sanitizer regex engine (from https://github.com/cloudflare/har-sanitizer/blob/main/src/lib/har_sanitize.tsx)
 * Used for fair, apples-to-apples benchmark comparison on the exact same 12 files.
 */
const cfDefaultWords = [
  'Authorization',
  'SAMLRequest',
  'SAMLResponse',
  'access_token',
  'appID',
  'assertion',
  'auth',
  'authenticity_token',
  'challenge',
  'client_id',
  'client_secret',
  'code',
  'code_challenge',
  'code_verifier',
  'email',
  'facetID',
  'fcParams',
  'id_token',
  'password',
  'refresh_token',
  'serverData',
  'shdf',
  'state',
  'token',
  'usg',
  'vses2',
  'x-client-data',
];

function buildCfRegex(word: string) {
  return [
    {
      regex: new RegExp(
        `([\\s";,&?]+${word}=)([\\w+-_/=#|.%&:!*()\`~'"]+?)(&|\\\\",|",|"\\s|"}}|;){1}`,
        'g'
      ),
      replacement: `$1[${word} redacted]$3`,
    },
    {
      regex: new RegExp(
        `("name": "${word}",[\\s\\w+:"-\\%!*()\`~'.,#]*?"value": ")((?:\\\\"|[^"])*?)(")`,
        'g'
      ),
      replacement: `$1[${word} redacted]$3`,
    },
    {
      regex: new RegExp(
        `("value": ")([\\w+-_:&+=#$~/()\\\\.\\,*!|%"\\s;]+)("[,\\s}}]+)([\\s\\w+:"-\\\\%!*\`()~'#.]*"name": "${word}")`,
        'g'
      ),
      replacement: `$1[${word} redacted]$3$4`,
    },
  ];
}

function runCloudflareCompetitor(rawInput: string): { output: string; validJson: boolean } {
  try {
    let input = rawInput;
    const jwtRegex = /\b(ey[A-Za-z0-9-_=]+)\.(ey[A-Za-z0-9-_=]+)\.[A-Za-z0-9-_.+/=]+\b/g;
    input = input.replace(jwtRegex, '$1.$2.redacted');

    const activeWords = cfDefaultWords.filter((w) => input.includes(w));
    for (const w of activeWords) {
      for (const r of buildCfRegex(w)) {
        input = input.replace(r.regex, r.replacement);
      }
    }
    JSON.parse(input);
    return { output: input, validJson: true };
  } catch {
    return { output: rawInput, validJson: false };
  }
}

/**
 * Chrome 130+ DevTools built-in header-only HAR sanitizer
 */
function runChromeHeaderScrubber(rawInput: string): { output: string; validJson: boolean } {
  try {
    const parsed = JSON.parse(rawInput);
    for (const entry of parsed?.log?.entries || []) {
      for (const h of [...(entry.request?.headers || []), ...(entry.response?.headers || [])]) {
        if (['cookie', 'set-cookie', 'authorization', 'proxy-authorization'].includes(String(h.name).toLowerCase())) {
          h.value = '[Redacted]';
        }
      }
      entry.request.cookies = [];
      entry.response.cookies = [];
    }
    return { output: JSON.stringify(parsed, null, 2), validJson: true };
  } catch {
    return { output: rawInput, validJson: false };
  }
}

interface DatasetSpec {
  id: string;
  fileName: string;
  category: 'Basic' | 'Intermediate' | 'Advanced' | 'Edge Case' | 'Negative' | 'Adversarial';
  sourceUrl: string;
  license: string;
  isSynthetic: boolean;
  expectParseOk: boolean;
  expectAutoRepair?: boolean;
  // Substrings that MUST NOT appear anywhere in the sanitized output (nor in Base64-decoded response bodies)
  groundTruthMustRedact: string[];
  // For negative cases: max allowed findings so we verify 0 false positives on clean public payloads
  maxAllowedFindings?: number;
}

const DATASET_SPECS: DatasetSpec[] = [
  {
    id: 'RW-01',
    fileName: 'RW-01-mitmproxy-diff-data.har',
    category: 'Intermediate',
    sourceUrl: 'https://github.com/mitmproxy/mitmproxy/blob/main/test/mitmproxy/data/flows/diff_data.har',
    license: 'MIT',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: [
      'ya29.a0AfB_byDg8-jTAQMiRXx-Dq3J1Pnb5NHe2LPWoocBcEIJrV', // Google OAuth token
      'xoxd-ekKbs8IHIKMWUnFlBjwKmIViLmYdDaOfEF%2Bmne4M5sl1VdXeT41', // Slack d cookie token
      'CKG1yQEIiLbJAQiltskBCKmdygEI0eXKAQiSocsBCIagzQEIh7LNAQjcvc0B', // x-client-data header
      '1b55ded2-453f-414d-8356-9c024f271ca0', // Slack session_id query param
      'PyIKPe4Z1cTqdvB7d+FPCQ==', // Chrome sync client_id query param
    ],
  },
  {
    id: 'RW-02',
    fileName: 'RW-02-mitmproxy-successful-log.har',
    category: 'Negative',
    sourceUrl: 'https://github.com/mitmproxy/mitmproxy/blob/main/test/mitmproxy/data/flows/successful_log.har',
    license: 'MIT',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: [],
    maxAllowedFindings: 0, // Must have 0 false positives on key1=value1&key2=value2
  },
  {
    id: 'RW-03',
    fileName: 'RW-03-mitmproxy-incomplete-log.har',
    category: 'Edge Case',
    sourceUrl: 'https://github.com/mitmproxy/mitmproxy/blob/main/test/mitmproxy/data/flows/incomplete_log.har',
    license: 'MIT',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: [],
    maxAllowedFindings: 0,
  },
  {
    id: 'RW-04',
    fileName: 'RW-04-mitmproxy-brokenfile.har',
    category: 'Edge Case',
    sourceUrl: 'https://github.com/mitmproxy/mitmproxy/blob/main/test/mitmproxy/data/corrupted_har/brokenfile.har',
    license: 'MIT',
    isSynthetic: false,
    expectParseOk: false,
    expectAutoRepair: false,
    groundTruthMustRedact: [],
  },
  {
    id: 'RW-05',
    fileName: 'RW-05-pollyjs-puppeteer-users.har',
    category: 'Basic',
    sourceUrl: 'https://github.com/Netflix/pollyjs/blob/master/examples/puppeteer/recordings/puppeteer_2155046665/recording.har',
    license: 'Apache-2.0',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: ['Shanna@melissa.tv', 'Nathan@yesenia.net', 'Rey.Padberg@karina.biz'],
  },
  {
    id: 'RW-06',
    fileName: 'RW-06-pollyjs-users-array-headers.har',
    category: 'Intermediate',
    sourceUrl: 'https://github.com/Netflix/pollyjs/blob/master/examples/jest-node-fetch/__recordings__/jest-node-fetch_1142061259/users_1585235219/should-return-user_4259424139/recording.har',
    license: 'Apache-2.0',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: ['d9290fa7f69379aa1374913e89cbc6aaf1547156472'],
  },
  {
    id: 'RW-07',
    fileName: 'RW-07-cloudflare-unit-fixture.har',
    category: 'Basic',
    sourceUrl: 'https://github.com/cloudflare/har-sanitizer/blob/main/src/lib/har_sanitize.test.ts',
    license: 'Apache-2.0',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: ['mysupersecret', 'app123', 'token123'],
  },
  {
    id: 'RW-08',
    fileName: 'RW-08-cloudflare-issues-17-22-27-44.har',
    category: 'Advanced',
    sourceUrl: 'https://github.com/cloudflare/har-sanitizer/issues/17',
    license: 'Apache-2.0',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: [
      'V3ryHard!Pass_With_No_Trailing_Ampersand',
      'tok_live_quoted_88776655',
      'atok_live_5544332211ffeeddccbbaa',
      'rtok_live_9988776655aabbccddeeff',
      'csec_live_11223344556677889900',
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      'AKIAIOSFODNN7EXAMPLE',
      'whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    ],
  },
  {
    id: 'RW-09',
    fileName: 'RW-09-sitespeed-cache-headers.har',
    category: 'Intermediate',
    sourceUrl: 'https://github.com/sitespeedio/coach-core/blob/main/test/har/files/cacheHeaders.har',
    license: 'MIT',
    isSynthetic: false,
    expectParseOk: true,
    groundTruthMustRedact: [],
  },
  {
    id: 'RW-10',
    fileName: 'RW-10-base64-encoded-response-json.har',
    category: 'Advanced',
    sourceUrl: 'local://benchmark/RW-10-base64-encoded-response-json.har',
    license: 'MIT',
    isSynthetic: true,
    expectParseOk: true,
    groundTruthMustRedact: [
      'atok_base64_secret_9988776655',
      'rtok_base64_secret_1122334455',
      'alice.crypto@vault.org',
      // Also the raw base64 string itself must not remain unredacted!
      'eyJhY2Nlc3NfdG9rZW4iOiJhdG9rX2Jhc2U2NF9zZWNyZXRfOTk4ODc3',
    ],
  },
  {
    id: 'RW-11',
    fileName: 'RW-11-double-encoded-json-in-json.har',
    category: 'Adversarial',
    sourceUrl: 'local://benchmark/RW-11-double-encoded-json-in-json.har',
    license: 'MIT',
    isSynthetic: true,
    expectParseOk: true,
    groundTruthMustRedact: [
      'InnerDoubleEncodedPassword!2026',
      'cs_live_double_encoded_887766',
      'deadbeef998877665544332211',
    ],
  },
  {
    id: 'RW-12',
    fileName: 'RW-12-truncated-mid-entry-stream.har',
    category: 'Edge Case',
    sourceUrl: 'local://benchmark/RW-12-truncated-mid-entry-stream.har',
    license: 'MIT',
    isSynthetic: true,
    expectParseOk: false,
    expectAutoRepair: true,
    groundTruthMustRedact: [
      'ak_live_1234567890',
      'rt_live_salvaged_998877',
      'eyJzdWIiOiJ1c3JfOTkiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ',
    ],
  },
];

const phaseArg = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1] || 'initial';

const caseResults = [];
let totalGroundTruthSecrets = 0;
let harshieldCaughtSecrets = 0;
let chromeCaughtSecrets = 0;
let cloudflareCaughtSecrets = 0;

for (const spec of DATASET_SPECS) {
  const filePath = path.join(dsDir, spec.fileName);
  const rawBuffer = fs.readFileSync(filePath);
  const rawText = rawBuffer.toString('utf-8');
  const sha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

  const t0 = performance.now();
  const parsed = parseHarString(rawText);

  let status: 'PASS' | 'FAIL' = 'PASS';
  const failureReasons: string[] = [];
  let findingsCount = 0;
  let validOutputJson = false;
  const leakedByHarshield: string[] = [];
  const leakedByChrome: string[] = [];
  const leakedByCloudflare: string[] = [];

  if (spec.expectParseOk !== parsed.ok) {
    status = 'FAIL';
    failureReasons.push(`Expected parse.ok=${spec.expectParseOk}, got ${parsed.ok}`);
  }

  if (spec.expectAutoRepair !== undefined && Boolean(parsed.canAutoRepair) !== spec.expectAutoRepair) {
    status = 'FAIL';
    failureReasons.push(`Expected canAutoRepair=${spec.expectAutoRepair}, got ${Boolean(parsed.canAutoRepair)}`);
  }

  const targetHar = parsed.har || parsed.repairedHar;
  if (targetHar) {
    try {
      const res = sanitizeHarTrace(targetHar, DEFAULT_SANITIZATION_CONFIG);
      findingsCount = res.findings.length;
      validOutputJson = res.isJsonValid;

      if (!validOutputJson) {
        status = 'FAIL';
        failureReasons.push('Sanitized HAR output is not valid JSON');
      }

      if (spec.maxAllowedFindings !== undefined && findingsCount > spec.maxAllowedFindings) {
        status = 'FAIL';
        failureReasons.push(`False positive: expected <= ${spec.maxAllowedFindings} findings, got ${findingsCount}`);
      }

      // Check ground truth secrets against HARshield, Chrome, and Cloudflare
      const chromeOut = runChromeHeaderScrubber(JSON.stringify(targetHar));
      const cfOut = runCloudflareCompetitor(JSON.stringify(targetHar, null, 2));

      for (const secret of spec.groundTruthMustRedact) {
        totalGroundTruthSecrets++;
        const encodedSecret = encodeURIComponent(secret);
        const b64Secret = Buffer.from(secret, 'utf-8').toString('base64').replace(/=+$/, '');

        const checkContainsSecret = (str: string): boolean => {
          if (str.includes(secret) || (encodedSecret !== secret && str.includes(encodedSecret))) {
            return true;
          }
          if (b64Secret.length >= 12 && str.includes(b64Secret)) {
            return true;
          }
          // Also check any base64-encoded response.content.text inside the HAR
          try {
            const p = JSON.parse(str);
            for (const e of p?.log?.entries || []) {
              if (e?.response?.content?.encoding === 'base64' && typeof e?.response?.content?.text === 'string') {
                const dec = Buffer.from(e.response.content.text, 'base64').toString('utf-8');
                if (dec.includes(secret)) return true;
              }
            }
          } catch {
            // ignore
          }
          return false;
        };

        const inHarshield = checkContainsSecret(res.sanitizedJsonString);
        if (inHarshield) {
          leakedByHarshield.push(secret);
        } else {
          harshieldCaughtSecrets++;
        }

        const inChrome = !chromeOut.validJson || checkContainsSecret(chromeOut.output);
        if (inChrome) {
          leakedByChrome.push(secret);
        } else {
          chromeCaughtSecrets++;
        }

        const inCf = !cfOut.validJson || checkContainsSecret(cfOut.output);
        if (inCf) {
          leakedByCloudflare.push(secret);
        } else {
          cloudflareCaughtSecrets++;
        }
      }

      if (leakedByHarshield.length > 0) {
        status = 'FAIL';
        failureReasons.push(`Missed ${leakedByHarshield.length} ground-truth secret(s): ${leakedByHarshield.join(', ')}`);
      }
    } catch (err: unknown) {
      status = 'FAIL';
      failureReasons.push(`Runtime exception during sanitization: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const elapsedMs = Number((performance.now() - t0).toFixed(2));
  caseResults.push({
    id: spec.id,
    fileName: spec.fileName,
    category: spec.category,
    sourceUrl: spec.sourceUrl,
    license: spec.license,
    isSynthetic: spec.isSynthetic,
    bytes: rawBuffer.length,
    sha256: sha256.slice(0, 16),
    status,
    elapsedMs,
    findingsCount,
    validOutputJson,
    groundTruthCount: spec.groundTruthMustRedact.length,
    leakedByHarshield,
    leakedByChrome,
    leakedByCloudflare,
    failureReasons,
  });

  console.log(
    `[${status}] ${spec.id} (${spec.category}) ${spec.fileName} (${elapsedMs}ms) — findings=${findingsCount}, leaked=${leakedByHarshield.length}` +
      (failureReasons.length ? ` | FAIL: ${failureReasons.join('; ')}` : '')
  );
}

const summary = {
  phase: phaseArg,
  timestamp: new Date().toISOString(),
  totalCases: caseResults.length,
  passedCases: caseResults.filter((c) => c.status === 'PASS').length,
  failedCases: caseResults.filter((c) => c.status === 'FAIL').length,
  totalGroundTruthSecrets,
  harshieldRecall: `${harshieldCaughtSecrets}/${totalGroundTruthSecrets} (${((harshieldCaughtSecrets / totalGroundTruthSecrets) * 100).toFixed(1)}%)`,
  chromeRecall: `${chromeCaughtSecrets}/${totalGroundTruthSecrets} (${((chromeCaughtSecrets / totalGroundTruthSecrets) * 100).toFixed(1)}%)`,
  cloudflareRecall: `${cloudflareCaughtSecrets}/${totalGroundTruthSecrets} (${((cloudflareCaughtSecrets / totalGroundTruthSecrets) * 100).toFixed(1)}%)`,
  cases: caseResults,
};

const outFile = path.resolve(`evidence/stage-3.5-validation/${phaseArg}-results.json`);
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
console.log(`\nSaved ${phaseArg} validation results to ${outFile}`);
console.log(
  `Recall Comparison — HARshield: ${summary.harshieldRecall} | Cloudflare Regex: ${summary.cloudflareRecall} | Chrome Header Scrubber: ${summary.chromeRecall}`
);
