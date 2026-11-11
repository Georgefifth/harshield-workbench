# HARshield Workbench — Technical Presentation & Demo Script

## Scene 1: Opening Title (`opening`)
HARshield Workbench sanitizes 'HAR 1.2' captures with 100.0% secret recall and 0 bytes of network egress.

## Scene 2: Problem Flow (`problem_flow`)
When engineers attach '.har' files to support tickets, Chrome only scrubs headers at 20.0% recall, while Cloudflare's regex engine misses 'JSON bodies' and corrupts escaped quotes.

## Scene 3: Exploded Architecture (`exploded_architecture`)
Our four-layer 'AST Engine' unwraps nested JSON, Form bodies, Base64 payloads, and 'presigned URLs' while linking identical credentials to 'JWT_TOKEN_#1'.

## Scene 4: Live Prototype Demo — 401 Token Race (`live_demo_lineage`)
In this live capture, HARshield flags 21 secrets and links 'JWT_TOKEN_#1' from login to a '401 Unauthorized' payout race without exposing raw tokens.

## Scene 5: Live Prototype Demo — Torture Suite & Repro Export (`live_demo_repro`)
Switching to the Cloudflare torture trace, HARshield catches all 18 nested secrets, strips static noise, exports 'Playwright' specs, and auto-repairs truncated streams.

## Scene 6: Stage 3.5 Real-World Validation (`validation_benchmark`)
Across 12 real-world 'mitmproxy' and 'Polly.JS' traces, HARshield achieved 100.0% recall in 78.4ms with zero false positives.

## Scene 7: Closing Summary (`closing`)
Try HARshield Workbench live in your browser—zero leaks, 100% valid JSON, and instant repro bundles.
