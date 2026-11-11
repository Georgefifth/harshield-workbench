export interface HarHeader {
  name: string;
  value: string;
  comment?: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarQueryParam {
  name: string;
  value: string;
}

export interface HarPostParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: HarPostParam[];
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: Record<string, unknown>;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  _Initiator?: string;
}

export interface HarFile {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HarEntry[];
  };
}

export type SecretLayer =
  | 'header'
  | 'cookie'
  | 'query'
  | 'request-json'
  | 'request-form'
  | 'response-json'
  | 'jwt-claim'
  | 'embedded-url'
  | 'high-entropy';

export type RedactionMode = 'pseudonym' | 'mask' | 'strict';

export interface RedactionFinding {
  id: string;
  entryIndex: number;
  layer: SecretLayer;
  fieldPath: string;
  keyName: string;
  rawPreview: string; // Safely truncated preview for local UI inspection
  rawHash: string; // Deterministic session fingerprint to link identical tokens
  replacement: string;
  category:
    | 'JWT / Bearer'
    | 'OAuth Token'
    | 'Session Cookie'
    | 'Password / Secret'
    | 'Presigned URL Sig'
    | 'API / Webhook Key'
    | 'PII (Email / Card / IP)'
    | 'Custom Rule';
  competitorMissReason?: string; // Explains if Chrome DevTools or Cloudflare har-sanitizer misses this
}

export interface TokenLineageGroup {
  pseudonym: string;
  category: RedactionFinding['category'];
  rawHash: string;
  metadataSummary?: string; // e.g. "alg:HS256 · sub:USER_#1 · exp:valid"
  occurrences: Array<{
    entryIndex: number;
    method: string;
    urlPath: string;
    status: number;
    direction: 'request' | 'response';
    layer: SecretLayer;
    fieldPath: string;
    role: 'ISSUED' | 'USED' | 'REJECTED_401' | 'PROPAGATED';
  }>;
}

export interface SanitizationConfig {
  mode: RedactionMode;
  stripNoiseEntries: boolean;
  redactHeadersAndCookies: boolean;
  redactNestedJsonBodies: boolean;
  redactFormBodies: boolean;
  redactJwtClaims: boolean;
  redactEmbeddedUrlSignatures: boolean;
  redactPii: boolean;
  customKeyPatterns: string[];
  customRegexPattern: string;
  excludedFindingIds: string[]; // User clicked to un-redact a specific non-secret finding
  forcedPaths: string[]; // User clicked a JSON path to force redaction
  manualSelectedEntries?: number[];
}

export interface CompetitorAuditResult {
  chromeHeaderScrubberCaught: number;
  chromeHeaderScrubberMissed: number;
  cloudflareRegexCaught: number;
  cloudflareRegexMissed: number;
  cloudflareJsonCorrupted: boolean;
  cloudflareCorruptionReason?: string;
  harshieldCaught: number;
  harshieldJsonValid: boolean;
}

export interface SanitizationResult {
  originalHar: HarFile;
  sanitizedHar: HarFile;
  sanitizedJsonString: string;
  isJsonValid: boolean;
  remainingRawLeaks: number;
  findings: RedactionFinding[];
  lineageGroups: TokenLineageGroup[];
  keptEntryIndices: number[];
  noiseEntryIndices: number[];
  originalBytes: number;
  sanitizedBytes: number;
  sha256Digest: string;
  competitorAudit: CompetitorAuditResult;
}

export interface PresetTrace {
  id: string;
  name: string;
  badge: string;
  shortDesc: string;
  diagnosticGoal: string;
  har: HarFile;
}
