# HARshield Workbench

**100% Client-Side, Structure-Preserving HAR 1.2 AST Sanitizer & Minimal Repro Bundler with Cross-Request Referential Pseudonymization.**

- **Live Public Workbench**: [https://georgefifth.github.io/harshield-workbench/](https://georgefifth.github.io/harshield-workbench/)
- **Repository**: [https://github.com/Georgefifth/harshield-workbench](https://github.com/Georgefifth/harshield-workbench)

---

## Why HARshield Exists

Whenever engineers, QA teams, or enterprise customers file a support ticket or bug report, they are asked to *"attach a `.har` network capture."* However, raw `.har` files recorded by browser DevTools contain live session cookies, OAuth `access_token` and `refresh_token` strings inside JSON responses, POST form passwords, GraphQL variables, and AWS presigned S3 signatures (`X-Amz-Signature`).

Existing solutions fail in three critical ways:
1. **Chrome 130+ Built-in Sanitizer (Header-Only Blindness)**: Only scrubs top-level `Cookie`, `Set-Cookie`, and `Authorization` headers (`20.0%` recall on our 12-trace real-world benchmark), leaving 100% of JSON request/response bodies and signed URLs exposed.
2. **Cloudflare `har-sanitizer` (Raw String Regex Failure)**: Applies regular expressions across the raw HAR text (`26.7%` recall), which corrupts JSON syntax when headers contain escaped quotes ([Issue #22](https://github.com/cloudflare/har-sanitizer/issues/22)), misses trailing form POST parameters ([Issue #17](https://github.com/cloudflare/har-sanitizer/issues/17)), ignores JSON response properties ([Issue #27](https://github.com/cloudflare/har-sanitizer/issues/27)), and misses query parameters inside embedded JSON URLs ([Issue #44](https://github.com/cloudflare/har-sanitizer/issues/44)).
3. **Destruction of Cross-Request Token Debugging**: Replacing every token with flat `[REDACTED]` makes it impossible to diagnose whether a `401 Unauthorized` failure occurred because a request sent a stale pre-refresh token or a newly rotated token.

---

## Core Architecture

1. **Zero-Egress Local V8 Airlock**: All parsing, AST traversal, and pseudonymization execute 100% in browser memory with self-hosted `@fontsource` typography and `0` outbound network calls.
2. **Recursive MIME & Double-JSON AST Walker (`src/engine/recursiveSanitizer.ts`)**: Unwraps HAR 1.2 headers (including `Polly.JS` array headers and inline `key=value` pairs), cookies, query strings, `application/json`, `application/x-www-form-urlencoded`, `encoding: "base64"` JSON response bodies, double-encoded JSON-in-JSON strings, and embedded presigned URLs, recalculating `bodySize` and `content.size` so exported `.har` files are 100% `JSON.parse()` valid.
3. **FNV-1a Referential Pseudonymizer (`src/engine/pseudonymizer.ts`)**: Normalizes credential cores (`Bearer <T>` == `<T>`) and assigns deterministic session aliases (`JWT_TOKEN_#1` vs `JWT_TOKEN_#2`), illuminating a **Referential Token Lineage Ribbon** across the waterfall.
4. **Minimal Repro Bundler & Truncated Stream Auto-Repair (`src/engine/reproExporter.ts`, `src/engine/harParser.ts`)**: Strips static font/CSS/telemetry noise entries, salvages complete entries from cut-off `.har` downloads, and exports `.sanitized.har`, redacted `curl` scripts, `@playwright/test` API specs, and Markdown incident reports.

---

## Stage 3.5 Real-World Benchmark (12 External & Benchmark HAR Captures)

Evaluated against 12 `.har` files sourced from `mitmproxy/mitmproxy` (MIT), `Netflix/pollyjs` (Apache-2.0), `cloudflare/har-sanitizer` (Apache-2.0), `sitespeedio/coach-core` (MIT), and adversarial encoding benchmarks (`evidence/stage-3.5-validation/`):

| Engine | Dataset Cases Passed | Ground-Truth Secret Recall (30 Secrets) | False Positives on Clean Traces | Valid JSON Output on Quoted Headers (#22) |
|---|---|---|---|---|
| **Chrome 131 Header Scrubber** | 4 / 12 (33.3%) | 6 / 30 (20.0%) | 0 | Pass |
| **Cloudflare `har-sanitizer` (Regex)** | 4 / 12 (33.3%) | 8 / 30 (26.7%) | 0 | **FAIL (Corrupts JSON)** |
| **HARshield Workbench (AST)** | **12 / 12 (100.0%)** | **30 / 30 (100.0%)** | **0** | **100% Valid JSON** |

---

## Local Development & Verification

```bash
npm install
npm test                                                  # Run Vitest unit suite (6/6 tests)
npm run build                                             # Type-check & production Vite build
npx vite-node scripts/run-stage3.5-validation.ts --phase=post-fix  # Run 12-HAR benchmark
BASE_URL=https://georgefifth.github.io/harshield-workbench/ node qa/run.mjs  # Run Playwright Firefox E2E QA
```

## License & Third-Party Credits

- Built with React 18, TypeScript, Vite, Tailwind CSS, and Lucide Icons.
- Benchmark test fixtures in `evidence/stage-3.5-validation/dataset/` are credited to their respective open-source authors: `mitmproxy/mitmproxy` (MIT), `Netflix/pollyjs` (Apache-2.0), `cloudflare/har-sanitizer` (Apache-2.0), and `sitespeedio/coach-core` (MIT).
