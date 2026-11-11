import { describe, expect, it } from 'vitest';
import { PRESET_TRACES, SAMPLE_JWT_1, SAMPLE_JWT_2 } from '../src/data/presets';
import { parseHarString } from '../src/engine/harParser';
import { inspectJwt, Pseudonymizer } from '../src/engine/pseudonymizer';
import {
  DEFAULT_SANITIZATION_CONFIG,
  sanitizeHarTrace,
} from '../src/engine/recursiveSanitizer';
import {
  generateCurlScript,
  generateMarkdownReport,
  generatePlaywrightTest,
} from '../src/engine/reproExporter';

describe('HARshield Workbench Core AST Sanitizer & Pseudonymizer', () => {
  it('decodes JWT headers/claims and assigns deterministic referential pseudonyms', () => {
    const jwt1Meta = inspectJwt(SAMPLE_JWT_1);
    expect(jwt1Meta.isJwt).toBe(true);
    expect(jwt1Meta.alg).toBe('HS256');
    expect(jwt1Meta.email).toBe('elena.vance@acme.io');

    const pseudo = new Pseudonymizer('pseudonym', 'test-salt');
    // Raw JWT in JSON response vs Bearer <JWT> in Authorization header must resolve to the SAME core alias!
    const fromResponse = pseudo.pseudonymize(SAMPLE_JWT_1, 'JWT / Bearer');
    const fromHeader = pseudo.pseudonymize(`Bearer ${SAMPLE_JWT_1}`, 'JWT / Bearer');
    const rotatedJwt = pseudo.pseudonymize(`Bearer ${SAMPLE_JWT_2}`, 'JWT / Bearer');

    expect(fromResponse.corePseudonym).toBe('JWT_TOKEN_#1');
    expect(fromHeader.corePseudonym).toBe('JWT_TOKEN_#1');
    expect(fromHeader.replacement).toBe('Bearer JWT_TOKEN_#1');
    expect(rotatedJwt.corePseudonym).toBe('JWT_TOKEN_#2');
  });

  it('preserves cross-request token lineage on OAuth 401 Race preset while removing 100% of raw secrets', () => {
    const preset = PRESET_TRACES.find((p) => p.id === 'oauth-401-race')!;
    const result = sanitizeHarTrace(preset.har, DEFAULT_SANITIZATION_CONFIG);

    expect(result.isJsonValid).toBe(true);
    expect(result.remainingRawLeaks).toBe(0);
    expect(result.findings.length).toBeGreaterThanOrEqual(15);

    // Ensure zero raw secrets exist anywhere in the output JSON string
    expect(result.sanitizedJsonString).not.toContain(SAMPLE_JWT_1);
    expect(result.sanitizedJsonString).not.toContain(SAMPLE_JWT_2);
    expect(result.sanitizedJsonString).not.toContain('Sup3rS3cret!Pass99');
    expect(result.sanitizedJsonString).not.toContain('cs_live_98a7b6c5d4e3f2a1');
    expect(result.sanitizedJsonString).not.toContain('rt_live_0991a882b773c664d555e444');
    expect(result.sanitizedJsonString).not.toContain('elena.vance@acme.io');
    expect(result.sanitizedJsonString).not.toContain('DE89370400440532013000');

    // Verify JWT_TOKEN_#1 is linked across Entry #1 (Response), Entry #3 (Request), and Entry #6 (401 Request)
    const jwt1Group = result.lineageGroups.find((g) => g.pseudonym === 'JWT_TOKEN_#1');
    expect(jwt1Group).toBeDefined();
    expect(jwt1Group!.occurrences.length).toBeGreaterThanOrEqual(3);
    expect(jwt1Group!.occurrences.some((o) => o.role === 'REJECTED_401')).toBe(true);
  });

  it('solves Cloudflare har-sanitizer open issues #17, #22, #27, and #44 without corrupting JSON', () => {
    const torture = PRESET_TRACES.find((p) => p.id === 'cloudflare-torture-suite')!;
    const result = sanitizeHarTrace(torture.har, DEFAULT_SANITIZATION_CONFIG);

    expect(result.isJsonValid).toBe(true);
    // Issue #17: Trailing password in x-www-form-urlencoded POST body without trailing delimiter
    expect(result.sanitizedJsonString).not.toContain('V3ryHard!Pass_With_No_Trailing_Ampersand');
    // Issue #22: Quoted inline key="value" inside X-Auth-Context header
    expect(result.sanitizedJsonString).not.toContain('tok_live_quoted_88776655');
    expect(result.competitorAudit.cloudflareJsonCorrupted).toBe(true);
    // Issue #27: Response JSON access_token / refresh_token / client_secret
    expect(result.sanitizedJsonString).not.toContain('atok_live_5544332211ffeeddccbbaa');
    expect(result.sanitizedJsonString).not.toContain('rtok_live_9988776655aabbccddeeff');
    expect(result.sanitizedJsonString).not.toContain('csec_live_11223344556677889900');
    // Issue #44: Query params (X-Amz-Signature) inside a URL inside a JSON response body
    expect(result.sanitizedJsonString).not.toContain(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    );
    expect(result.sanitizedJsonString).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result.sanitizedJsonString).not.toContain('whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b');
  });

  it('strips static/telemetry noise entries and generates valid cURL, Playwright, and Markdown bundles', () => {
    const checkout = PRESET_TRACES.find((p) => p.id === 'stripe-webhook-checkout')!;
    const filtered = sanitizeHarTrace(checkout.har, {
      ...DEFAULT_SANITIZATION_CONFIG,
      stripNoiseEntries: true,
    });

    expect(checkout.har.log.entries.length).toBe(5);
    expect(filtered.sanitizedHar.log.entries.length).toBe(2); // Only the 2 API calls remain

    const curl = generateCurlScript(filtered);
    expect(curl).toContain('https://api.velox.io/v1/payment-intents');
    expect(curl).toContain('https://api.velox.io/v1/checkout/confirm');
    expect(curl).not.toContain('sk_test_velox_998877665544332211aabbcc');

    const pw = generatePlaywrightTest(filtered);
    expect(pw).toContain("import { test, expect } from '@playwright/test';");
    expect(pw).toContain('expect(res_2.status()).toBe(500);');

    const md = generateMarkdownReport(filtered, checkout.name);
    expect(md).toContain('# Diagnostic Incident Bundle');
    expect(md).toContain('100% VALID HAR 1.2 JSON');
  });

  it('auto-repairs truncated HAR streams and recovers complete HTTP entries', () => {
    const truncated = `{"log":{"version":"1.2","entries":[{"startedDateTime":"2026-11-11T00:00:00Z","time":10,"request":{"method":"GET","url":"https://api.example.com/v1?api_key=ak_live_1234567890","httpVersion":"HTTP/2","cookies":[],"headers":[],"queryString":[],"headersSize":10,"bodySize":0},"response":{"status":200,"statusText":"OK","httpVersion":"HTTP/2","cookies":[],"headers":[],"content":{"size":2,"mimeType":"application/json","text":"{}"},"redirectURL":"","headersSize":10,"bodySize":2},"cache":{},"timings":{"send":1,"wait":8,"receive":1}},{"startedDateTime":"2026-11-11T00:00:01Z","request":{"url":"https://truncated`;
    const parsed = parseHarString(truncated);
    expect(parsed.ok).toBe(false);
    expect(parsed.canAutoRepair).toBe(true);
    expect(parsed.repairedHar?.log.entries.length).toBe(1);
  });

  it('handles Stage 3.5 real-world edge cases: Polly.JS array headers, Base64 JSON responses, and double-encoded JSON-in-JSON', () => {
    const b64Json = Buffer.from(
      JSON.stringify({ access_token: 'atok_b64_998877', email: 'b64@vault.io' }),
      'utf-8'
    ).toString('base64');

    const edgeHar = {
      log: {
        version: '1.2',
        creator: { name: 'Polly.JS', version: '1.4.1' },
        entries: [
          {
            startedDateTime: '2026-11-11T00:00:00Z',
            time: 12,
            request: {
              method: 'POST',
              url: 'https://api.example.com/v1/envelope?session_id=sid_99887766',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [
                {
                  name: 'set-cookie',
                  // Polly.JS v1.4.1 array header value dialect
                  value: ['__cfduid=d9290fa7f69379aa; Path=/; HttpOnly'] as unknown as string,
                },
                {
                  name: 'X-Custom-Auth',
                  value: 'client_secret=mysupersecret&client_id=app123',
                },
              ],
              queryString: [{ name: 'session_id', value: 'sid_99887766' }],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify({
                  inner: JSON.stringify({ password: 'DoubleEncodedSecret!99' }),
                }),
              },
              headersSize: 100,
              bodySize: 64,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/1.1',
              cookies: [],
              headers: [],
              content: {
                size: b64Json.length,
                mimeType: 'application/json',
                encoding: 'base64',
                text: b64Json,
              },
              redirectURL: '',
              headersSize: 50,
              bodySize: b64Json.length,
            },
            cache: {},
            timings: { send: 1, wait: 10, receive: 1 },
          },
        ],
      },
    };

    const res = sanitizeHarTrace(edgeHar, DEFAULT_SANITIZATION_CONFIG);
    expect(res.isJsonValid).toBe(true);
    expect(res.sanitizedJsonString).not.toContain('d9290fa7f69379aa');
    expect(res.sanitizedJsonString).not.toContain('mysupersecret');
    expect(res.sanitizedJsonString).not.toContain('app123');
    expect(res.sanitizedJsonString).not.toContain('sid_99887766');
    expect(res.sanitizedJsonString).not.toContain('DoubleEncodedSecret!99');

    const decodedResp = Buffer.from(
      res.sanitizedHar.log.entries[0].response.content.text!,
      'base64'
    ).toString('utf-8');
    expect(decodedResp).not.toContain('atok_b64_998877');
    expect(decodedResp).not.toContain('b64@vault.io');
  });
});
