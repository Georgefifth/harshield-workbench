import { PresetTrace } from '../types/har';

// Valid Base64URL JWT #1: header {"alg":"HS256","typ":"JWT"}, payload {"sub":"usr_prod_8841","email":"elena.vance@acme.io","role":"billing_admin","exp":1893456000}
export const SAMPLE_JWT_1 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfcHJvZF84ODQxIiwiZW1haWwiOiJlbGVuYS52YW5jZUBhY21lLmlvIiwicm9sZSI6ImJpbGxpbmdfYWRtaW4iLCJleHAiOjE4OTM0NTYwMDB9.7xK9mP2vQ8nL4jR6wT1yZ5cB3fH8dG0sA9eU2iO4pM8';

// Valid Base64URL JWT #2 (rotated token after refresh): payload {"sub":"usr_prod_8841","email":"elena.vance@acme.io","role":"billing_admin","jti":"rot_2","exp":1893459600}
export const SAMPLE_JWT_2 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfcHJvZF84ODQxIiwiZW1haWwiOiJlbGVuYS52YW5jZUBhY21lLmlvIiwicm9sZSI6ImJpbGxpbmdfYWRtaW4iLCJqdGkiOiJyb3RfMiIsImV4cCI6MTg5MzQ1OTYwMH0.9bN4vX1zL7kM3qP5rT8wY2cF6hJ0dG4sA1eU9iO3pQ2';

export const PRESET_TRACES: PresetTrace[] = [
  {
    id: 'oauth-401-race',
    name: 'OAuth Token Refresh & 401 Race Condition',
    badge: 'AUTH RACE · 6 ENTRIES',
    shortDesc: 'Demonstrates cross-request token lineage (JWT_TOKEN_#1 vs JWT_TOKEN_#2) + form/response body redaction.',
    diagnosticGoal:
      'Entry #4 rotates the Bearer token to JWT_TOKEN_#2, but concurrent Entry #6 accidentally sends stale JWT_TOKEN_#1 and fails with 401 Unauthorized. Naive [REDACTED] scrubbers destroy this proof; HARshield preserves the causal link without leaking either token.',
    har: {
      log: {
        version: '1.2',
        creator: { name: 'Chrome DevTools', version: '131.0.6778.86' },
        entries: [
          {
            startedDateTime: '2026-11-11T18:10:01.120Z',
            time: 142,
            request: {
              method: 'POST',
              url: 'https://auth.acme-cloud.io/oauth/token',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
                { name: 'User-Agent', value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0' },
                { name: 'X-Client-Key', value: 'ak_live_99887766554433221100' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/x-www-form-urlencoded',
                text: 'grant_type=password&username=elena.vance%40acme.io&password=Sup3rS3cret!Pass99&client_id=acme-web-portal&client_secret=cs_live_98a7b6c5d4e3f2a1',
                params: [
                  { name: 'grant_type', value: 'password' },
                  { name: 'username', value: 'elena.vance@acme.io' },
                  { name: 'password', value: 'Sup3rS3cret!Pass99' },
                  { name: 'client_id', value: 'acme-web-portal' },
                  { name: 'client_secret', value: 'cs_live_98a7b6c5d4e3f2a1' },
                ],
              },
              headersSize: 210,
              bodySize: 147,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [
                {
                  name: '__Host-acme_sid',
                  value: 's%3A9f8e7d6c5b4a3.sig9918273645',
                  path: '/',
                  httpOnly: true,
                  secure: true,
                },
              ],
              headers: [
                { name: 'Content-Type', value: 'application/json; charset=utf-8' },
                {
                  name: 'Set-Cookie',
                  value: '__Host-acme_sid=s%3A9f8e7d6c5b4a3.sig9918273645; Path=/; Secure; HttpOnly',
                },
              ],
              content: {
                size: 382,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    access_token: SAMPLE_JWT_1,
                    refresh_token: 'rt_live_0991a882b773c664d555e444',
                    token_type: 'Bearer',
                    expires_in: 3600,
                    user: {
                      id: 'usr_prod_8841',
                      email: 'elena.vance@acme.io',
                    },
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 185,
              bodySize: 382,
            },
            cache: {},
            timings: { send: 4, wait: 128, receive: 10 },
          },
          {
            startedDateTime: '2026-11-11T18:10:01.300Z',
            time: 18,
            request: {
              method: 'GET',
              url: 'https://cdn.acme-cloud.io/static/fonts/space-grotesk-v16.woff2',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Accept', value: 'font/woff2' }],
              queryString: [],
              headersSize: 92,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'font/woff2' }],
              content: {
                size: 44120,
                mimeType: 'font/woff2',
                text: '[binary-font-payload]',
              },
              redirectURL: '',
              headersSize: 88,
              bodySize: 44120,
            },
            cache: {},
            timings: { send: 1, wait: 11, receive: 6 },
          },
          {
            startedDateTime: '2026-11-11T18:10:01.410Z',
            time: 86,
            request: {
              method: 'GET',
              url: 'https://api.acme-cloud.io/v2/workspaces/ws_99/profile?api_key=ak_live_99887766554433221100',
              httpVersion: 'HTTP/2.0',
              cookies: [
                {
                  name: '__Host-acme_sid',
                  value: 's%3A9f8e7d6c5b4a3.sig9918273645',
                },
              ],
              headers: [
                { name: 'Authorization', value: `Bearer ${SAMPLE_JWT_1}` },
                { name: 'Cookie', value: '__Host-acme_sid=s%3A9f8e7d6c5b4a3.sig9918273645' },
              ],
              queryString: [{ name: 'api_key', value: 'ak_live_99887766554433221100' }],
              headersSize: 312,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 164,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    workspace: 'ws_99',
                    ownerEmail: 'elena.vance@acme.io',
                    stripeCustomerId: 'cus_Prod99182736',
                    status: 'active',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 96,
              bodySize: 164,
            },
            cache: {},
            timings: { send: 2, wait: 76, receive: 8 },
          },
          {
            startedDateTime: '2026-11-11T18:10:02.050Z',
            time: 119,
            request: {
              method: 'POST',
              url: 'https://auth.acme-cloud.io/oauth/token',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    grant_type: 'refresh_token',
                    refresh_token: 'rt_live_0991a882b773c664d555e444',
                    client_secret: 'cs_live_98a7b6c5d4e3f2a1',
                  },
                  null,
                  2
                ),
              },
              headersSize: 140,
              bodySize: 138,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 320,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    access_token: SAMPLE_JWT_2,
                    refresh_token: 'rt_live_7777f666e555d444c333b222',
                    token_type: 'Bearer',
                    expires_in: 3600,
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 110,
              bodySize: 320,
            },
            cache: {},
            timings: { send: 3, wait: 108, receive: 8 },
          },
          {
            startedDateTime: '2026-11-11T18:10:02.060Z',
            time: 24,
            request: {
              method: 'POST',
              url: 'https://telemetry.segment.io/v1/batch',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: '{"batch":[{"event":"page_view","properties":{"path":"/billing"}}]}',
              },
              headersSize: 95,
              bodySize: 66,
            },
            response: {
              status: 202,
              statusText: 'Accepted',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: { size: 15, mimeType: 'application/json', text: '{"success":true}' },
              redirectURL: '',
              headersSize: 80,
              bodySize: 15,
            },
            cache: {},
            timings: { send: 2, wait: 19, receive: 3 },
          },
          {
            startedDateTime: '2026-11-11T18:10:02.095Z',
            time: 64,
            request: {
              method: 'POST',
              url: 'https://api.acme-cloud.io/v2/workspaces/ws_99/billing/payout',
              httpVersion: 'HTTP/2.0',
              cookies: [
                {
                  name: '__Host-acme_sid',
                  value: 's%3A9f8e7d6c5b4a3.sig9918273645',
                },
              ],
              headers: [
                // BUG: Sends stale SAMPLE_JWT_1 instead of rotated SAMPLE_JWT_2!
                { name: 'Authorization', value: `Bearer ${SAMPLE_JWT_1}` },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    amountCents: 125000,
                    currency: 'USD',
                    destinationIban: 'DE89370400440532013000',
                    approverEmail: 'elena.vance@acme.io',
                  },
                  null,
                  2
                ),
              },
              headersSize: 295,
              bodySize: 136,
            },
            response: {
              status: 401,
              statusText: 'Unauthorized',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'WWW-Authenticate', value: 'Bearer error="invalid_token", error_description="Token superseded by rotation"' },
              ],
              content: {
                size: 142,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    error: 'token_revoked_by_rotation',
                    message: 'The bearer token presented was superseded by refresh event rot_2.',
                    traceId: 'req_99481a72',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 192,
              bodySize: 142,
            },
            cache: {},
            timings: { send: 3, wait: 55, receive: 6 },
          },
        ],
      },
    },
  },
  {
    id: 'cloudflare-torture-suite',
    name: 'Cloudflare Issues #17 / #22 / #27 / #44 Torture Suite',
    badge: 'COMPETITOR BENCHMARK · 3 ENTRIES',
    shortDesc: 'Reproduces the 4 open GitHub bugs in cloudflare/har-sanitizer (escaped quotes JSON corruption, response tokens, presigned URLs in JSON).',
    diagnosticGoal:
      'Proves why regex over raw HAR strings fails: escaped quotes in headers trigger JSON corruption (#22), form POST tails (#17), response OAuth secrets (#27), and AWS X-Amz-Signature inside JSON bodies (#44).',
    har: {
      log: {
        version: '1.2',
        creator: { name: 'Firefox DevTools', version: '132.0' },
        entries: [
          {
            startedDateTime: '2026-11-11T19:00:00.000Z',
            time: 95,
            request: {
              method: 'POST',
              url: 'https://portal.cloud-edge.dev/api/v1/session/login',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
                // Escaped quotes inside header value trigger cloudflare/har-sanitizer Issue #22 when paired with downstream token name
                {
                  name: 'X-Auth-Context',
                  value: 'realm="prod-us-east", token="tok_live_quoted_88776655", mode="strict"',
                },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/x-www-form-urlencoded',
                // Trailing password without delimiter triggers Issue #17
                text: 'email=devops%40cloud-edge.dev&totp=491028&password=V3ryHard!Pass_With_No_Trailing_Ampersand',
                params: [
                  { name: 'email', value: 'devops@cloud-edge.dev' },
                  { name: 'totp', value: '491028' },
                  { name: 'password', value: 'V3ryHard!Pass_With_No_Trailing_Ampersand' },
                ],
              },
              headersSize: 220,
              bodySize: 91,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 245,
                mimeType: 'application/json',
                // Issue #27: Response JSON properties are NOT matched by Cloudflare's ("name": "word", "value": "...") regex
                text: JSON.stringify(
                  {
                    status: 'authenticated',
                    access_token: 'atok_live_5544332211ffeeddccbbaa',
                    refresh_token: 'rtok_live_9988776655aabbccddeeff',
                    client_secret: 'csec_live_11223344556677889900',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 100,
              bodySize: 245,
            },
            cache: {},
            timings: { send: 3, wait: 84, receive: 8 },
          },
          {
            startedDateTime: '2026-11-11T19:00:01.100Z',
            time: 112,
            request: {
              method: 'POST',
              url: 'https://portal.cloud-edge.dev/api/v1/storage/presign-dump',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer atok_live_5544332211ffeeddccbbaa' },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    bucket: 'prod-customer-backups',
                    objectKey: 'tenant-42/pg_dump_2026.sql.gz',
                    sseCustomerKey: 'dGhpcyBpcyBhIDMyIGJ5dGUgc2VjcmV0IGtleS4uLg==',
                  },
                  null,
                  2
                ),
              },
              headersSize: 180,
              bodySize: 158,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 368,
                mimeType: 'application/json',
                // Issue #44: Query params (X-Amz-Signature, X-Amz-Credential) inside a URL inside a JSON response body!
                text: JSON.stringify(
                  {
                    presignedPutUrl:
                      'https://prod-customer-backups.s3.us-east-1.amazonaws.com/tenant-42/pg_dump_2026.sql.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20261111%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261111T190001Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                    downloadUrl:
                      'https://cdn.cloud-edge.dev/dl/pg_dump_2026.sql.gz?token=dl_tok_8899001122334455&sig=hmac_77665544332211',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 112,
              bodySize: 368,
            },
            cache: {},
            timings: { send: 4, wait: 98, receive: 10 },
          },
          {
            startedDateTime: '2026-11-11T19:00:02.400Z',
            time: 134,
            request: {
              method: 'POST',
              url: 'https://portal.cloud-edge.dev/graphql',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer atok_live_5544332211ffeeddccbbaa' },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    operationName: 'RotateWebhookEndpoint',
                    query:
                      'mutation RotateWebhookEndpoint($input: WebhookInput!) { rotateWebhook(input: $input) { id signingSecret } }',
                    variables: {
                      input: {
                        endpointUrl: 'https://hooks.internal-corp.net/stripe?apiKey=ak_live_998877665544332211',
                        webhookSecret: 'whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
                        adminEmail: 'secops@internal-corp.net',
                      },
                    },
                  },
                  null,
                  2
                ),
              },
              headersSize: 175,
              bodySize: 390,
            },
            response: {
              status: 502,
              statusText: 'Bad Gateway',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 162,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    errors: [
                      {
                        message: 'Upstream KMS signing timeout while validating whsec_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
                        code: 'KMS_TIMEOUT_502',
                      },
                    ],
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 110,
              bodySize: 162,
            },
            cache: {},
            timings: { send: 3, wait: 125, receive: 6 },
          },
        ],
      },
    },
  },
  {
    id: 'saml-oidc-enterprise',
    name: 'Okta / SAML Assertion & Support Ticket Spill',
    badge: 'ENTERPRISE SSO · 3 ENTRIES',
    shortDesc: 'Sanitizes SAMLResponse payloads, OIDC id_token claims, session cookies, and internal IP/email PII.',
    diagnosticGoal:
      'Prevents Okta/Cloudflare-style support ticket session hijacking when customers capture SSO callback redirects that fail with 403 Forbidden.',
    har: {
      log: {
        version: '1.2',
        creator: { name: 'Edge DevTools', version: '131.0' },
        entries: [
          {
            startedDateTime: '2026-11-11T20:15:00.000Z',
            time: 188,
            request: {
              method: 'POST',
              url: 'https://sso.enterprise-bank.com/saml2/acs',
              httpVersion: 'HTTP/2.0',
              cookies: [{ name: 'DT', value: 'DI1892739182739182739182' }],
              headers: [
                { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
                { name: 'Cookie', value: 'DT=DI1892739182739182739182; oktaStateToken=00aBcDeFgHiJkLmNoPqRsTuVwXyZ123456' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/x-www-form-urlencoded',
                text: 'SAMLResponse=PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPjxzYW1sOkFzc2VydGlvbj5zZWNyZXQtc2FtbC1hc3NlcnRpb24tYmxvYjwvc2FtbDpBc3NlcnRpb24+PC9zYW1scDpSZXNwb25zZT4=&RelayState=https%3A%2F%2Fapp.enterprise-bank.com%2Fvault%3Fsession_key%3Dsk_vault_88371920',
                params: [
                  {
                    name: 'SAMLResponse',
                    value:
                      'PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPjxzYW1sOkFzc2VydGlvbj5zZWNyZXQtc2FtbC1hc3NlcnRpb24tYmxvYjwvc2FtbDpBc3NlcnRpb24+PC9zYW1scDpSZXNwb25zZT4=',
                  },
                  {
                    name: 'RelayState',
                    value: 'https://app.enterprise-bank.com/vault?session_key=sk_vault_88371920',
                  },
                ],
              },
              headersSize: 240,
              bodySize: 280,
            },
            response: {
              status: 302,
              statusText: 'Found',
              httpVersion: 'HTTP/2.0',
              cookies: [
                {
                  name: '__Secure-next-auth.session-token',
                  value: SAMPLE_JWT_1,
                  httpOnly: true,
                  secure: true,
                },
              ],
              headers: [
                {
                  name: 'Location',
                  value: 'https://app.enterprise-bank.com/vault/callback?code=authcode_9988112233445566&state=csrf_776655',
                },
                {
                  name: 'Set-Cookie',
                  value: `__Secure-next-auth.session-token=${SAMPLE_JWT_1}; Path=/; Secure; HttpOnly`,
                },
              ],
              content: { size: 0, mimeType: 'text/plain', text: '' },
              redirectURL:
                'https://app.enterprise-bank.com/vault/callback?code=authcode_9988112233445566&state=csrf_776655',
              headersSize: 380,
              bodySize: 0,
            },
            cache: {},
            timings: { send: 5, wait: 175, receive: 8 },
          },
          {
            startedDateTime: '2026-11-11T20:15:00.220Z',
            time: 74,
            request: {
              method: 'GET',
              url: 'https://app.enterprise-bank.com/api/vault/permissions?code=authcode_9988112233445566',
              httpVersion: 'HTTP/2.0',
              cookies: [
                {
                  name: '__Secure-next-auth.session-token',
                  value: SAMPLE_JWT_1,
                },
              ],
              headers: [
                {
                  name: 'Cookie',
                  value: `__Secure-next-auth.session-token=${SAMPLE_JWT_1}`,
                },
                { name: 'X-Forwarded-For', value: '10.24.198.44' },
              ],
              queryString: [{ name: 'code', value: 'authcode_9988112233445566' }],
              headersSize: 340,
              bodySize: 0,
            },
            response: {
              status: 403,
              statusText: 'Forbidden',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 210,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    error: 'insufficient_saml_group_claim',
                    principalEmail: 'elena.vance@acme.io',
                    clientIp: '10.24.198.44',
                    requiredRole: 'urn:enterprise:vault:approver',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 110,
              bodySize: 210,
            },
            cache: {},
            timings: { send: 3, wait: 65, receive: 6 },
          },
          {
            startedDateTime: '2026-11-11T20:15:00.310Z',
            time: 12,
            request: {
              method: 'GET',
              url: 'https://app.enterprise-bank.com/static/logo.svg',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Accept', value: 'image/svg+xml' }],
              queryString: [],
              headersSize: 80,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'image/svg+xml' }],
              content: { size: 1240, mimeType: 'image/svg+xml', text: '<svg></svg>' },
              redirectURL: '',
              headersSize: 80,
              bodySize: 1240,
            },
            cache: {},
            timings: { send: 1, wait: 8, receive: 3 },
          },
        ],
      },
    },
  },
  {
    id: 'stripe-webhook-checkout',
    name: 'Payment Checkout 500 Crash & Heavy Noise Filter',
    badge: 'NOISE REDUCTION · 5 ENTRIES',
    shortDesc: 'Strips 60% static/analytics noise entries while redacting payment tokens, cards, and API keys for a clean cURL/Playwright repro.',
    diagnosticGoal:
      'Isolates a 500 Internal Server Error during multi-currency checkout from noisy analytics/CSS requests and generates an executable Playwright API reproduction test.',
    har: {
      log: {
        version: '1.2',
        creator: { name: 'Chrome DevTools', version: '131.0' },
        entries: [
          {
            startedDateTime: '2026-11-11T21:00:00.000Z',
            time: 15,
            request: {
              method: 'GET',
              url: 'https://shop.velox.io/assets/app.88a1b2.css',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Accept', value: 'text/css' }],
              queryString: [],
              headersSize: 80,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'text/css' }],
              content: { size: 18400, mimeType: 'text/css', text: 'body { margin: 0; }' },
              redirectURL: '',
              headersSize: 80,
              bodySize: 18400,
            },
            cache: {},
            timings: { send: 1, wait: 10, receive: 4 },
          },
          {
            startedDateTime: '2026-11-11T21:00:00.100Z',
            time: 92,
            request: {
              method: 'POST',
              url: 'https://api.velox.io/v1/payment-intents',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer sk_test_velox_998877665544332211aabbcc' },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    amount: 49900,
                    currency: 'eur',
                    customerEmail: 'marcus.chen@velox-client.org',
                    paymentMethodToken: 'pm_card_visa_live_998877665544',
                  },
                  null,
                  2
                ),
              },
              headersSize: 165,
              bodySize: 152,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 185,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    intentId: 'pi_3NzVelox887766',
                    client_secret: 'pi_3NzVelox887766_secret_LiveToken9988776655',
                    status: 'requires_confirmation',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 98,
              bodySize: 185,
            },
            cache: {},
            timings: { send: 3, wait: 81, receive: 8 },
          },
          {
            startedDateTime: '2026-11-11T21:00:00.250Z',
            time: 19,
            request: {
              method: 'POST',
              url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX99',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'text/plain' }],
              queryString: [
                { name: 'v', value: '2' },
                { name: 'tid', value: 'G-XXXX99' },
              ],
              headersSize: 90,
              bodySize: 0,
            },
            response: {
              status: 204,
              statusText: 'No Content',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [],
              content: { size: 0, mimeType: 'text/plain', text: '' },
              redirectURL: '',
              headersSize: 60,
              bodySize: 0,
            },
            cache: {},
            timings: { send: 1, wait: 16, receive: 2 },
          },
          {
            startedDateTime: '2026-11-11T21:00:00.320Z',
            time: 14,
            request: {
              method: 'GET',
              url: 'https://shop.velox.io/assets/hero-banner.webp',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Accept', value: 'image/webp' }],
              queryString: [],
              headersSize: 75,
              bodySize: 0,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'image/webp' }],
              content: { size: 96400, mimeType: 'image/webp', text: '[binary-image]' },
              redirectURL: '',
              headersSize: 80,
              bodySize: 96400,
            },
            cache: {},
            timings: { send: 1, wait: 9, receive: 4 },
          },
          {
            startedDateTime: '2026-11-11T21:00:00.510Z',
            time: 215,
            request: {
              method: 'POST',
              url: 'https://api.velox.io/v1/checkout/confirm',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [
                { name: 'Authorization', value: 'Bearer sk_test_velox_998877665544332211aabbcc' },
                { name: 'Content-Type', value: 'application/json' },
              ],
              queryString: [],
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    intentId: 'pi_3NzVelox887766',
                    client_secret: 'pi_3NzVelox887766_secret_LiveToken9988776655',
                    customerEmail: 'marcus.chen@velox-client.org',
                  },
                  null,
                  2
                ),
              },
              headersSize: 168,
              bodySize: 158,
            },
            response: {
              status: 500,
              statusText: 'Internal Server Error',
              httpVersion: 'HTTP/2.0',
              cookies: [],
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              content: {
                size: 174,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    error: 'currency_settlement_mismatch',
                    message: 'Unhandled null pointer in FX rate lock for intent pi_3NzVelox887766',
                    requestId: 'req_velox_500_991',
                  },
                  null,
                  2
                ),
              },
              redirectURL: '',
              headersSize: 104,
              bodySize: 174,
            },
            cache: {},
            timings: { send: 4, wait: 203, receive: 8 },
          },
        ],
      },
    },
  },
];
