import { RedactionFinding, RedactionMode } from '../types/har';

export interface JwtMetadata {
  isJwt: boolean;
  alg?: string;
  typ?: string;
  sub?: string;
  email?: string;
  role?: string;
  jti?: string;
  exp?: number;
  isExpired?: boolean;
}

function safeBase64UrlDecode(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    if (typeof atob === 'function') {
      return atob(base64 + pad);
    }
    return Buffer.from(base64 + pad, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function inspectJwt(rawToken: string): JwtMetadata {
  const trimmed = rawToken.replace(/^(Bearer|JWT)\s+/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || !parts[0].startsWith('eyJ') || !parts[1].startsWith('eyJ')) {
    return { isJwt: false };
  }
  const headerStr = safeBase64UrlDecode(parts[0]);
  const payloadStr = safeBase64UrlDecode(parts[1]);
  if (!headerStr || !payloadStr) {
    return { isJwt: false };
  }
  try {
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    // Reference timestamp: Nov 2026 (1794441600)
    const isExpired = exp !== undefined ? exp * 1000 < Date.now() : undefined;
    return {
      isJwt: true,
      alg: header.alg || 'HS256',
      typ: header.typ || 'JWT',
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      jti: typeof payload.jti === 'string' ? payload.jti : undefined,
      exp,
      isExpired,
    };
  } catch {
    return { isJwt: false };
  }
}

export function fnv1aHash(input: string, salt = 'harshield-v1'): string {
  const str = `${salt}:${input}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class Pseudonymizer {
  private salt: string;
  private mode: RedactionMode;
  private counters: Map<string, number> = new Map();
  private valueToAlias: Map<string, { alias: string; hash: string; meta?: string }> = new Map();

  constructor(mode: RedactionMode = 'pseudonym', salt = 'harshield-session-2026') {
    this.mode = mode;
    this.salt = salt;
  }

  public normalizeSecretCore(raw: string): { prefix: string; core: string } {
    const bearerMatch = raw.match(/^(Bearer|Basic|Token|Digest)\s+(.+)$/i);
    if (bearerMatch) {
      return { prefix: `${bearerMatch[1]} `, core: bearerMatch[2].trim() };
    }
    return { prefix: '', core: raw.trim() };
  }

  private getPrefixLabel(category: RedactionFinding['category'], isJwt: boolean): string {
    if (isJwt) return 'JWT_TOKEN';
    switch (category) {
      case 'JWT / Bearer':
        return 'BEARER_TOKEN';
      case 'OAuth Token':
        return 'OAUTH_TOKEN';
      case 'Session Cookie':
        return 'SESSION_COOKIE';
      case 'Password / Secret':
        return 'SECRET_CREDENTIAL';
      case 'Presigned URL Sig':
        return 'PRESIGNED_SIG';
      case 'API / Webhook Key':
        return 'API_KEY';
      case 'PII (Email / Card / IP)':
        return 'PII_IDENTIFIER';
      case 'Custom Rule':
        return 'CUSTOM_REDACTED';
      default:
        return 'REDACTED_TOKEN';
    }
  }

  public pseudonymize(
    rawValue: string,
    category: RedactionFinding['category']
  ): { replacement: string; rawHash: string; corePseudonym: string; metadataSummary?: string } {
    const { prefix, core } = this.normalizeSecretCore(rawValue);
    const rawHash = fnv1aHash(core, this.salt);

    const existing = this.valueToAlias.get(core);
    if (existing) {
      return {
        replacement: `${prefix}${existing.alias}`,
        rawHash: existing.hash,
        corePseudonym: existing.alias,
        metadataSummary: existing.meta,
      };
    }

    const jwtInfo = inspectJwt(core);
    const label = this.getPrefixLabel(category, jwtInfo.isJwt);
    const nextIdx = (this.counters.get(label) || 0) + 1;
    this.counters.set(label, nextIdx);

    let metaSummary: string | undefined;
    if (jwtInfo.isJwt) {
      const parts = [`alg:${jwtInfo.alg}`];
      if (jwtInfo.sub) {
        const subHash = fnv1aHash(jwtInfo.sub, this.salt).slice(0, 4);
        parts.push(`sub:USR_${subHash}`);
      }
      if (jwtInfo.jti) {
        parts.push(`jti:${jwtInfo.jti}`);
      }
      parts.push(jwtInfo.isExpired ? 'exp:EXPIRED' : 'exp:VALID');
      metaSummary = parts.join(' · ');
    }

    let alias: string;
    if (this.mode === 'strict') {
      alias = `[REDACTED_${label}]`;
    } else if (this.mode === 'mask') {
      if (core.includes('@')) {
        alias = `user_${nextIdx}@redacted.local`;
      } else {
        const head = core.slice(0, Math.min(3, core.length));
        alias = `${head}***[${label}_#${nextIdx}]***`;
      }
    } else {
      // Referential pseudonym mode (default)
      if (core.includes('@') && category === 'PII (Email / Card / IP)') {
        alias = `EMAIL_#${nextIdx}@example.redact`;
      } else {
        alias = `${label}_#${nextIdx}`;
      }
    }

    this.valueToAlias.set(core, { alias, hash: rawHash, meta: metaSummary });
    return {
      replacement: `${prefix}${alias}`,
      rawHash,
      corePseudonym: alias,
      metadataSummary: metaSummary,
    };
  }
}
