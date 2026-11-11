# Stage 1 — Market Research, Competitive Analysis & Candidate Direction Screening

## 0. Hackathon Context & Judging Criteria (Verified Fact)

- **Event**: Silicon Valley Buildathon (`https://silicon-valley-buildathon.devpost.com/`)
- **Rules Page**: `https://silicon-valley-buildathon.devpost.com/rules`
- **Tagline**: *"Take a rough idea off the workbench, turn it into a working prototype, and show what it can do at Silicon Valley Buildathon."*
- **Workbench Spirit**: *"The garage is wherever you build. Silicon Valley Buildathon takes its cue from the workbench. Start with a rough idea, build the part you’re most curious about, and get it working well enough that someone else can try it. Maybe it’s a browser tool that saves ten clicks, a game with a mechanic you’ve never seen, or a device that makes an ordinary task easier... Show us the moment the project comes to life. Let us see someone use it, walk us through a choice you made, and tell us what changed after your first test."*
- **Official Judging Criteria**:
  1. **Execution**: Does the demo show a working core feature?
  2. **Originality**: What makes the approach distinctive?
  3. **Value to users**: How well does it serve the people it was built for?
  4. **Demo and iteration**: Does the team show how testing shaped the build?

---

## 1. Phase 1: Market Exploration & Early Disqualifications

### 1.1 Devpost Winning Projects Analyzed (Reference Only)
Per `prompts/01-research.md`, Devpost projects were analyzed strictly as execution references rather than proof of product-market fit:
- **BrowseGraph** (`https://devpost.com/software/browsegraph`): Uses in-browser `PGlite` + `pgvector` + `ReactFlow` to turn browsing history into a local knowledge graph. *Takeaway*: Local-first browser execution with zero server setup makes demos immediately testable by judges, though generic browsing graphs struggle with daily retention.
- **Data Center Lens** (`https://devpost.com/software/datacenter-lens`): Civic utility combining satellite views and municipal resource modeling to inspect local data center footprints. *Takeaway*: Domain-specific workbench utilities with concrete quantitative outputs outperform generic dashboards.
- **SafeScan** (`https://devpost.com/software/safescan-omnfvj`): Pre-scan QR code phishing and physical sticker-tamper inspector. *Takeaway*: Narrow, verifiable security/inspection workflows with clear pass/warn verdicts resonate strongly when paired with real test cases.

### 1.2 Directions Investigated and Eliminated Early (Falsification-First)
Before selecting our 7 candidate directions, we actively searched for counter-evidence and eliminated ideas that are already well-solved by mature tools:
1. **Interactive Regex Step Debugger & ReDoS Analyzer** — *Eliminated*: **Regex101** (`https://regex101.com/`) already provides a mature step-by-step PCRE/JS debugger, execution step counter, and catastrophic backtracking warning for free in the browser. Building another regex tester offers zero meaningful switching reason.
2. **Visual Cron & DST Schedule Viewer** — *Eliminated*: **Crontab.guru** (`https://crontab.guru/`) and **Healthchecks.io** (`https://healthchecks.io/`) cover basic cron syntax well; while multi-timezone DST shift preview is nice, it is too narrow (a 30-second lookup widget) to sustain deep workbench iteration.
3. **Generic AI Wrapper for Markdown / Notes / PDF Chat** — *Eliminated*: Violates Principle #7 & #8 ("不要为了新颖而新颖，也不要为了使用 AI 而强行引入 AI"). Existing tools (Obsidian, Notion, NotebookLM) completely dominate this space.

---

## 2. Phase 2: 7 Distinct Candidate Directions (Developer Tools, Creation Software, Productivity Tools)

---

### Direction 1: **HARshield Workbench** — Structure-Preserving HAR & Network Trace Sanitizer + Minimal Repro Bundler (Developer & Support Productivity Tool)

- **Target Users & Concrete Pain Points**:
  - Frontend/backend engineers, QA engineers, DevOps/SREs, and technical customers asked by vendor support (Cloudflare, Okta, Stripe, Datadog, internal platform teams) to *"attach a `.har` capture or `curl` reproduction of the failing request."*
  - **Pain Point**: Raw `.har` files recorded by Chrome/Firefox DevTools capture the entire browser session across dozens of background requests, embedding `Cookie`, `Set-Cookie`, `Authorization` headers, OAuth `refresh_token` / `access_token` fields inside JSON POST bodies and responses, GraphQL variables, AWS presigned URL query params (`X-Amz-Signature`), and PII (emails, phone numbers, internal hostnames). Sharing an unsanitized HAR leaks live session hijack tokens (as seen in the high-profile Okta/Cloudflare HAR support-ticket breaches); manually editing a 15 MB JSON HAR file in VS Code takes 15–30 minutes and frequently corrupts JSON syntax or breaks replayability.
- **How Users Currently Solve This**:
  1. Chrome 130+ DevTools *"Save all as HAR (sanitized)"* — only strips top-level `Cookie`, `Set-Cookie`, and `Authorization` headers; leaves JSON request/response bodies, OAuth tokens in responses, and signed URL parameters inside bodies completely untouched.
  2. Cloudflare's `har-sanitizer` (`https://har-sanitizer.pages.dev/`) — performs naive regex replacements across the raw file string, which frequently corrupts valid JSON or misses POST/response bodies.
  3. Opening the `.har` in a text editor and manually Find-and-Replacing tokens, which destroys token correlation (you can no longer tell if Request B used the same token returned by Response A).
- **Existing Products & Links**:
  - **Cloudflare `har-sanitizer`**: `https://github.com/cloudflare/har-sanitizer` (253★, Apache-2.0, hosted at `https://har-sanitizer.pages.dev/`, free).
  - **Google Harbor / HAR Analyzer**: `https://toolbox.googleapps.com/apps/har_analyzer/` (Free, read-only viewer with zero sanitization or export).
  - **Chrome DevTools Built-in HAR Export**: Built into Chromium 130+ (Free, header-only scrubbing).
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: In `cloudflare/har-sanitizer`, open Issue **#17** (`https://github.com/cloudflare/har-sanitizer/issues/17`) documents that fields submitted via `postData` (such as `password` or JSON body secrets) are not redacted properly.
  - **Verified Fact**: Issue **#27** (`https://github.com/cloudflare/har-sanitizer/issues/27`) documents: *"This tool seems to only sanitize request properties. Access and refresh tokens remain visible in the POST response."*
  - **Verified Fact**: Issue **#22** (`https://github.com/cloudflare/har-sanitizer/issues/22`) and Issue **#29** (`https://github.com/cloudflare/har-sanitizer/issues/29`) confirm that regex-based replacement across raw HAR text produces invalid, unparseable JSON (`HAR produced after sanitization is no longer valid json`).
  - **Verified Fact**: Issue **#44** (`https://github.com/cloudflare/har-sanitizer/issues/44`) shows that presigned query params (`X-Amz-Signature`) embedded inside JSON response bodies fail to sanitize because regex delimiters miss nested JSON strings.
  - **Verified Fact**: Issue **#35** (`https://github.com/cloudflare/har-sanitizer/issues/35`) highlights user distrust in uploading sensitive HAR files to third-party domains when unsure if network requests occur.
- **Concrete Improvements We Provide**:
  1. **100% Client-Side AST/Recursive Parser (Zero Network Egress)**: Parses the HAR 1.2 JSON tree AND recursively parses nested `application/json`, `application/x-www-form-urlencoded`, Multipart, JWT claims, and embedded URLs inside `request.postData.text` and `response.content.text`, guaranteeing 100% valid JSON output on export and recalculating byte lengths accurately.
  2. **Deterministic Pseudonymization (Referential Integrity)**: Instead of replacing every secret with `[REDACTED]` (which breaks debugging when diagnosing whether Token A in login response matches Token A in a subsequent `401 Unauthorized` call), replaces sensitive values with deterministic format-preserving pseudonyms (`JWT_TOKEN_#1 [exp: valid, sub: USER_#1]`, `API_KEY_#2`, `EMAIL_#1@example.redact`) using an in-memory session salt.
  3. **Noise Filtering & One-Click Repro Bundler**: Lets the user isolate the exact failing request chain (stripping out 90% of analytics/font/image noise requests), inspect a side-by-side Redaction Diff Audit Log, and export either a guaranteed-valid `.sanitized.har`, a redacted `curl` / Playwright test script, or a self-contained Markdown Incident Bundle.
- **Why Users Would Switch**:
  - Solves the exact failure modes reported in Cloudflare's `har-sanitizer` (#17, #22, #27, #44) and Chrome's header-only scrubber while cutting a 20-minute error-prone manual redaction task down to 3 clicks (<15 seconds) entirely offline in the browser.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium. Requires careful recursive MIME-type parsing (JSON-in-JSON, URL-encoded bodies, JWT decoding without verification, GraphQL variables, cookie jars) and high-density waterfall/diff UI.
  - **Main Risk**: False negatives on custom proprietary token formats; mitigated by combining structural key/entropy detection with interactive click-to-redact and custom path rules.
  - **Feasibility**: Very High (100% deterministic TypeScript in browser, zero paid API keys required).
- **MVP & Quantitative Validation**:
  - **MVP**: Drag-and-drop HAR loader (plus built-in realistic sample HARs containing OAuth flows, GraphQL mutations, presigned S3 URLs, and failing 500/401 traces) → automatic deep AST scan across headers, cookies, query strings, and nested JSON/form bodies → interactive Redaction Audit table + Waterfall filter → side-by-side Before/After JSON diff → verified export (`.sanitized.har`, redacted `curl`, Markdown repro).
  - **Validation**: Test against a benchmark corpus of real-world HAR structures (OAuth refresh flows, AWS presigned URLs in JSON bodies, multipart uploads, malformed/edge-case encodings) measuring: (a) 100% JSON schema validity after scrub, (b) recall/precision across headers + nested POST/response bodies, and (c) preservation of cross-request token correlation.
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: Chrome's sanitizer only scrubs headers; Cloudflare's regex sanitizer breaks JSON validity (#22) and misses response tokens (#27) and nested URL params (#44).
  - *Reasonable Inference*: Engineers debugging auth/API failures need deterministic token aliases (`TOKEN_#1` vs `TOKEN_#2`) rather than flat `[REDACTED]` strings to prove whether a bug is caused by a stale token.
  - *Unverified Hypothesis*: Support teams and developers will use the Noise Filter + Repro Bundler alongside sanitization rather than exporting the full unfiltered HAR.
- **5-Dimension Scoring**:
  - **Practical Value**: **9.0/10** — Directly prevents credential leaks during a routine weekly engineering/support task.
  - **Originality**: **8.5/10** — Referential-integrity pseudonymization (`TOKEN_#1` tracking across request/response chains) + recursive JSON-in-HAR AST redaction is genuinely distinct from regex scrubbers.
  - **Competitive Advantage**: **9.0/10** — Clear, provable technical superiority over `cloudflare/har-sanitizer` on Issues #17, #22, #27, #44.
  - **User Experience**: **9.0/10** — Fits the "Silicon Valley Workbench" aesthetic perfectly: inspect trace, toggle rules, verify diff, export clean bundle in seconds.
  - **Feasibility**: **9.5/10** — 100% client-side, deterministic, zero external dependencies or flaky APIs.

---

### Direction 2: **PlanDiff Workbench** — PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` Side-by-Side Tree Diff & Bottleneck Simulator (Developer Tool)

- **Target Users & Concrete Pain Points**:
  - Backend engineers, DBAs, and full-stack developers optimizing slow PostgreSQL queries (tuning indexes, rewriting CTEs/joins, upgrading PG versions, or testing `enable_seqscan=off`).
  - **Pain Point**: When tuning a query, engineers always have **two or more** `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plans: *Plan A (Before index / before rewrite)* and *Plan B (After index / after rewrite)*. Existing visualizers like Dalibo PEV2 only render **one plan at a time**. Comparing a 60-node Plan A against a 60-node Plan B requires flipping between two browser tabs and manually hunting for where a `Seq Scan` turned into an `Index Only Scan`, where `Merge Join` switched to `Hash Join`, or whether `Shared Read Blocks` actually dropped.
- **How Users Currently Solve This**:
  1. Opening two browser tabs of `explain.dalibo.com` or `explain.depesz.com` and visually hunting node-by-node.
  2. Running `diff -u before.txt after.txt` on raw text `EXPLAIN` output — which fails completely because changing one inner join re-indents the entire text tree and changes every cost/timing float.
- **Existing Products & Links**:
  - **Dalibo PEV2 (`pev2`)**: `https://github.com/dalibo/pev2` (3,616★, PostgreSQL License, hosted at `https://explain.dalibo.com/`, free).
  - **explain.depesz.com**: `https://explain.depesz.com/` (Free web visualizer, single-plan tabular view).
  - **pgMustard**: `https://www.pgmustard.com/` (Commercial paid SaaS, £95+/yr, single-plan tips).
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: In `dalibo/pev2`, open Issue **#377** (`https://github.com/dalibo/pev2/issues/377`) requests: *"Ability to compare plans... Would be nice to compare nodes of both and highlight by red where differences."*
  - **Verified Fact**: Open Issue **#428** (`https://github.com/dalibo/pev2/issues/428`) from a DBA states verbatim: *"We have more and more customers asking us why this plan is better than another one. In a nutshell, they want to compare the two plans... The two plans I have to compare today have 173/175 nodes. I'll do it manually as I have no other choice right now, but I would love to have the possibility with PEV2 to compare trees. What I'm mostly interested in is node types: did the planner replace a merge join with a hash join? did it replace a seq scan with a some kind of index scan?"*
  - **Verified Fact**: Open Issues **#687** (`https://github.com/dalibo/pev2/issues/687`), **#689** (`https://github.com/dalibo/pev2/issues/689`), and **#874** (`https://github.com/dalibo/pev2/issues/874`) document missing actionable index/recheck hints when `Rows Removed by Filter` or `Rows Removed by Index Recheck` is high.
- **Concrete Improvements We Provide**:
  1. **Semantic Plan Tree Alignment & Diff Algorithm**: Aligns Plan A and Plan B by relation/alias (`Relation Name`, `Alias`, join structure, and output subtrees) rather than raw text lines, highlighting node transitions (`Seq Scan → Index Scan`, `Sort + Merge Join → Hash Join`) and calculating exact deltas for Execution Time ($\Delta\text{ms}$), I/O Buffers ($\Delta\text{Shared Hit/Read/Dirtied}$), and Planner Row-Estimation Error ($\text{Actual Rows} / \text{Plan Rows}$).
  2. **In-Browser Live SQL Sandbox (Powered by PGlite WASM) + Paste Mode**: Users can either paste any two production `EXPLAIN (ANALYZE, BUFFERS)` JSON/text plans OR run live SQL schema + index experiments directly in the browser via embedded PostgreSQL (`@electric-sql/pglite`) to generate Before/After `EXPLAIN ANALYZE` plans on the fly and diff them in one click.
  3. **Deterministic Bottleneck & DDL Index Advisor**: Flags high `Rows Removed by Filter`, lossy heap blocks (#689), repeated index lookups (#874), and outputs copy-pasteable `CREATE INDEX` DDL candidates and Markdown PR benchmark reports showing the verified speedup.
- **Why Users Would Switch**:
  - Directly solves `dalibo/pev2` Issues #377 and #428 (structural comparison of two plans) plus generates ready-to-paste GitHub PR performance evidence tables.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium-High. Tree matching across mutated query plans (where join order changes) requires a robust relation/subtree similarity matcher so nodes align meaningfully even when tree topology shifts.
  - **Main Risk**: Complex plan rewrites may rearrange join order so completely that 1-to-1 node alignment is only partial; mitigated by providing both **Relation/Table-Centric Diff** (which always aligns 100% by table/alias scan) and **Structural Tree Diff**.
  - **Feasibility**: High. PostgreSQL `EXPLAIN` JSON/text structure is well-specified, and `@electric-sql/pglite` (or pure TypeScript parser) runs 100% in the browser.
- **MVP & Quantitative Validation**:
  - **MVP**: Dual-pane / unified `EXPLAIN (ANALYZE, BUFFERS)` workbench supporting both JSON & text formats → Relation-aligned & Tree-aligned visual diff → Delta metrics summary (Time, Shared Buffers Read/Hit, Row Estimate skew, Scan type changes) → Actionable Index/Recheck diagnostics (#687/#689/#874) → PR Markdown Benchmark table export.
  - **Validation**: Evaluate against a benchmark dataset of 15+ real PostgreSQL query optimization pairs (Seq Scan → Index Scan, correlated subquery → Hash Join, Bitmap Recheck lossy blocks, composite index ordering) verifying 100% parser accuracy, node transition detection accuracy, and buffer/latency delta math.
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: PEV2 lacks plan diffing (#377, #428) and specific index/recheck hints (#687, #689, #874).
  - *Reasonable Inference*: Aligning two plans by scanned relation/alias + join output solves the topological shift problem that breaks text diffs.
  - *Unverified Hypothesis*: Developers writing GitHub PRs for database migrations will adopt the one-click Markdown PR diff summary export.
- **5-Dimension Scoring**:
  - **Practical Value**: **9.0/10** — Solves a documented, high-pain DBA/backend engineering bottleneck (#428).
  - **Originality**: **9.0/10** — Relation-aware & topological query plan tree diffing + buffer I/O delta workbench does not exist in PEV2 or depesz.
  - **Competitive Advantage**: **8.5/10** — Can build cleanly on top of PostgreSQL's standard `EXPLAIN` specification while adding the #1 requested comparative workflow.
  - **User Experience**: **8.5/10** — High-density flame/tree diff with synchronized hover between Before and After nodes.
  - **Feasibility**: **9.0/10** — Deterministic parsing and tree-matching algorithms; zero external server dependency.

---

### Direction 3: **SVGcraft Workbench** — Multi-Icon SVG Production Sanitizer, ID De-Collider & Keyframe Path Morph Studio (Creation Software & Frontend Tool)

- **Target Users & Concrete Pain Points**:
  - UI designers, frontend engineers, and design-system maintainers exporting SVG icons/illustrations from Figma or Illustrator into React/Vue/Web component libraries.
  - **Pain Point**:
    1. **Silent DOM ID Collisions**: Figma exports `<linearGradient id="paint0_linear">` and `<clipPath id="clip0">` in every SVG. When 5 icons are rendered inline on the same webpage, the browser binds all 5 icons to the *first* icon's `#clip0` or `#paint0_linear`, causing broken clipping and invisible icons whenever the first icon is hidden (`svg/svgo#674`).
    2. **Broken `currentColor` & Non-Flattened Transforms**: Exporting multi-path icons with mixed `fill`/`stroke` and nested `transform="matrix(...)"` makes icons impossible to theme with CSS `currentColor` (`jakearchibald/svgomg#173`, `svg/svgo#624`).
    3. **Incompatible Path Morphing**: When animating between two SVG states (e.g., Play ↔ Pause, Menu ↔ Close, Empty ↔ Checked) via CSS `d: path(...)` or Framer Motion, the animation glitches wildly unless both `<path d="...">` strings have the exact same command count, command types (`C` vs `L`), and winding order.
- **How Users Currently Solve This**:
  1. Running **SVGOMG** (`https://jakearchibald.github.io/svgomg/`) one file at a time — no multi-icon collision simulator, no smart selective `currentColor` promotion, and no path-morph normalization.
  2. Using **Yqnn SVG Path Editor** (`https://yqnn.github.io/svg-path-editor/`) to manually rewrite cubic bezier points by hand.
- **Existing Products & Links**:
  - **SVGOMG**: `https://github.com/jakearchibald/svgomg` (6,213★, Apache-2.0, free web UI for SVGO).
  - **Yqnn SVG Path Editor**: `https://github.com/Yqnn/svg-path-editor` (5,348★, Apache-2.0, free single-path editor).
  - **SVGO**: `https://github.com/svg/svgo` (22,811★, MIT, CLI library).
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: `jakearchibald/svgomg` Issue **#173** (`https://github.com/jakearchibald/svgomg/issues/173`) requests `currentColor` conversion support in the GUI, which remains unmerged after years.
  - **Verified Fact**: `svg/svgo` Issue **#624** (`https://github.com/svg/svgo/issues/624`, 40 comments) documents struggles with flattening nested `transform` matrices into path coordinates cleanly.
  - **Verified Fact**: `svg/svgo` Issue **#674** (`https://github.com/svg/svgo/issues/674`, 57 comments) documents `<defs>` ID collisions when multiple optimized SVGs live on the same DOM page.
  - **Verified Fact**: `Yqnn/svg-path-editor` Issues **#170** (`https://github.com/Yqnn/svg-path-editor/issues/170`) and **#183** (`https://github.com/Yqnn/svg-path-editor/issues/183`) show usability gaps in subpath readability and arc control points, and it only edits a single static `d` string (no State A ↔ State B morph alignment).
- **Concrete Improvements We Provide**:
  1. **DOM Collision Simulator & Deterministic ID Scoping**: Drop a batch of SVGs onto the workbench; it detects colliding `id="clip0"` / `url(#paint0)` across files, simulates how they break when rendered together on a single page, and rewrites them with deterministic content-hashed prefixes.
  2. **True Coordinate Transform Baking & Optical ViewBox Normalizer**: Bakes all nested `<g transform="...">` matrices directly into normalized `<path>` cubic/line coordinates (`svg/svgo#624`), normalizes optical padding onto a standard grid (e.g. `24x24`), and promotes palette colors to `currentColor` (`svgomg#173`) while preserving deliberate accent/cutout fills.
  3. **State A ↔ State B Path Morph Normalizer**: Takes any two SVG paths (e.g., Hamburger vs. Close X), converts primitives (`<rect>`, `<circle>`, `<line>`, `<polyline>`) into cubic Beziers, subdivides segments to equalize command counts, aligns starting vertices and winding direction to minimize twist, and exports zero-dependency CSS `@keyframes` / React SVG components.
- **Why Users Would Switch**:
  - Replaces 3 separate disconnected tools (SVGOMG + Path Editor + manual Bezier subdivision) with one interactive visual workbench for shipping production icon systems and micro-interactions.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium. Path parsing, affine matrix multiplication on SVG arcs (`A` → cubic bezier conversion), and segment subdivision require solid computational geometry.
  - **Main Risk**: Complex multi-subpath illustrations (`M ... Z M ... Z` with unequal subpath counts) require clear fallback/splitting strategies during morphing.
  - **Feasibility**: High (100% browser-native SVG + Canvas + TypeScript math).
- **MVP & Quantitative Validation**:
  - **MVP**: Multi-SVG workbench with 3 integrated stations: (1) DOM ID Collision Inspector & Batch Scoper, (2) Transform Flattener + `currentColor` Theme Matrix Preview (Light/Dark/RTL/16px–64px pixel grid), and (3) Path A ↔ Path B Keyframe Morph Compiler with live scrubbing and React/CSS export.
  - **Validation**: Test on a corpus of 20+ messy Figma/Illustrator SVG exports (colliding IDs, nested matrix transforms, primitive shapes, mismatched vertex counts) measuring: zero DOM ID collisions, `<0.01px` geometric Hausdorff error after transform flattening, and 100% valid CSS `d: path(...)` morph compatibility.
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: Inline SVGs from Figma collide on `#clip0`/`#paint0` (`svgo#674`), SVGOMG lacks `currentColor` tooling (`svgomg#173`), and CSS `d: path()` morphing fails in browsers unless path command sequences match 1-to-1.
  - *Reasonable Inference*: Frontend developers building UI micro-interactions want a visual way to align two icon states without learning Adobe After Effects / Lottie.
  - *Unverified Hypothesis*: Design system engineers will prefer an interactive browser workbench over configuring custom SVGO AST plugins in Node.js.
- **5-Dimension Scoring**:
  - **Practical Value**: **8.5/10** — Directly solves daily frontend SVG headaches (clipPath bugs, viewBox alignment, icon state morphing).
  - **Originality**: **8.5/10** — Combining DOM collision simulation with interactive Bezier vertex-equalized path morphing is visually compelling and unique.
  - **Competitive Advantage**: **8.0/10** — Builds on standard SVG specs while solving documented gaps in SVGOMG (#173) and SVGO (#624, #674).
  - **User Experience**: **9.5/10** — Highly visual, tactile canvas workbench with immediate before/after geometry and animation playback.
  - **Feasibility**: **9.0/10** — Pure client-side computational geometry, fast to verify visually with Playwright.

---

### Direction 4: **ContractGuard Workbench** — OpenAPI 3.0/3.1 `allOf` Semantic Diff, Sunset Enforcer & Live Payload Breakage Simulator (Developer Tool)

- **Target Users & Concrete Pain Points**:
  - API platform engineers, backend developers, and SDK maintainers evolving REST APIs specified in OpenAPI 3.0 / 3.1.
  - **Pain Point**: Before merging an API change, teams need to know: *"Will this schema change break existing mobile/web clients or existing webhook payloads?"* CLI tools like `oasdiff` output terminal text, struggle with complex `allOf` + `additionalProperties: false` compositions (`oasdiff#1383`) and OpenAPI 3.1 `$ref` sibling `x-sunset` annotations (`oasdiff#1361`), and **cannot test a real production JSON sample payload against both Old and New specs side-by-side** to show *which exact client requests will suddenly fail with `400 Bad Request` or drop fields*.
- **How Users Currently Solve This**:
  1. Running `oasdiff breaking old.yaml new.yaml` in CI — text-only output, blind to whether real client traffic actually hits the changed branch.
  2. Manually diffing 4,000-line YAML files in GitHub PRs where `$ref` changes are separated by 2,000 lines from the endpoints that reference them.
- **Existing Products & Links**:
  - **oasdiff**: `https://github.com/oasdiff/oasdiff` (1,463★, Apache-2.0, Go CLI + paid SaaS web service).
  - **pb33f `openapi-changes`**: `https://github.com/pb33f/openapi-changes` (362★, Apache-2.0, Go CLI/TUI).
  - **Bump.sh**: `https://bump.sh/` (Commercial SaaS, €149+/mo for team plans).
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: `oasdiff/oasdiff` open Issue **#1383** (`https://github.com/oasdiff/oasdiff/issues/1383`) documents that `--flatten-allof` drops overlay properties when the `allOf` base has `additionalProperties: false`, hiding breaking `request-property-became-required` changes.
  - **Verified Fact**: `oasdiff/oasdiff` open Issue **#1361** (`https://github.com/oasdiff/oasdiff/issues/1361`) documents that in OpenAPI 3.1, `x-sunset` placed next to a property's `$ref` is ignored, allowing premature breaking property removal before the sunset date.
  - **Verified Fact**: `oasdiff/oasdiff` open Issue **#1403** (`https://github.com/oasdiff/oasdiff/issues/1403`) documents description-only edits triggering false-positive `response-property-one-of-added` warnings.
- **Concrete Improvements We Provide**:
  1. **Full `$ref` + `allOf`/`oneOf` Dereferenced Effective-Schema Diff**: Resolves and merges `allOf` branches while preserving `additionalProperties: false` constraints (#1383) and OpenAPI 3.1 `$ref` sibling metadata (`deprecated`, `x-sunset`, #1361), eliminating description-only false positives (#1403).
  2. **Live Client Traffic & Payload Breakage Simulator**: Generates realistic v1 client request/response payloads (or accepts pasted production JSON logs/HAR requests) and runs them through both Spec v1 and Spec v2 validators simultaneously — pinpointing the exact JSON pointers (`/body/items/0/sku`) that pass in v1 but fail validation or lose required fields in v2.
  3. **Migration Guide & TypeScript SDK Diff Generator**: Automatically drafts the consumer migration matrix and exact TypeScript interface diff (`v1.d.ts` vs `v2.d.ts`).
- **Why Users Would Switch**:
  - Turns abstract schema diff rules into concrete **Payload Replay Proofs** (*"Here is the exact v1 JSON payload that now throws HTTP 400 under v2"*), running 100% in the browser without uploading internal API specs to a SaaS vendor.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium. Requires recursive `$ref` cycle handling, `allOf`/`oneOf`/`anyOf` effective schema normalization, and JSON Schema draft 2020-12 / OpenAPI 3.0–3.1 validation.
  - **Main Risk**: Deeply recursive circular `$ref` schemas can cause stack overflows if cycle detection isn't built into the dereferencer from day one.
  - **Feasibility**: High (TypeScript + YAML/JSON AST parsing in browser).
- **MVP & Quantitative Validation**:
  - **MVP**: Split-spec OpenAPI 3.0/3.1 workbench → Effective Schema Dereferencer & Breaking Change Classifier (fixing `allOf` #1383, `$ref` sibling `x-sunset` #1361, and description-only #1403) → Live Payload Replay Simulator → Consumer Migration Guide & TypeScript diff export.
  - **Validation**: Benchmark against a test suite of 15+ OpenAPI spec pairs (including the exact reproduction cases from `oasdiff#1383`, `oasdiff#1361`, `oasdiff#1403`, circular `$ref`s, polymorphic `oneOf` discriminators, and enum narrowing).
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: `oasdiff` has open edge-case bugs on `allOf` + `additionalProperties: false` (#1383), OpenAPI 3.1 `$ref` sibling `x-sunset` (#1361), and `oneOf` descriptions (#1403).
  - *Reasonable Inference*: Seeing a concrete v1 JSON request fail against v2 schema is faster for reviewers to understand than reading abstract rule codes.
  - *Unverified Hypothesis*: Teams will use a browser workbench for interactive PR review alongside their CI linters.
- **5-Dimension Scoring**:
  - **Practical Value**: **8.5/10** — Prevents accidental production API outages.
  - **Originality**: **8.0/10** — Coupling OpenAPI breaking-change detection with live v1-on-v2 payload replay simulation and TypeScript consumer diffing is a strong workflow upgrade.
  - **Competitive Advantage**: **8.0/10** — Directly addresses open `oasdiff` issues (#1383, #1361, #1403) in an interactive local-first GUI.
  - **User Experience**: **8.0/10** — Clear endpoint tree, severity badges, and interactive payload tester.
  - **Feasibility**: **9.0/10** — Pure deterministic AST logic in TypeScript.

---

### Direction 5: **FontForgelet / FontShift Zero** — Browser-First Web Font Subsetter, `unicode-range` Splitter & Zero-CLS Metric Override Workbench (Creation & Web Performance Tool)

- **Target Users & Concrete Pain Points**:
  - Frontend engineers, web designers, and performance-focused indie creators shipping custom `.ttf` / `.otf` / `.woff2` typography on marketing sites, docs, and web apps.
  - **Pain Point**:
    1. **Cumulative Layout Shift (CLS) & Flash of Unstyled Text**: When a custom web font loads over the network, swapping from Arial/system-ui to the custom font causes paragraphs and headings to jump in height because the fallback font has different `ascent`, `descent`, `line-gap`, and `x-width` metrics.
    2. **Bloated Font Files & Broken CLI Tooling**: A full `.ttf` font is often 300 KB–2 MB, yet a website only uses Latin + Punctuation (18 KB). Existing CLI tools like `glyphhanger` fail to install due to legacy Puppeteer dependencies (`zachleat/glyphhanger#4`, `#23`), struggle with variable font weight ranges (`#22`), and `unjs/fontaine` has CSS parsing bugs on multi-word unquoted font families (`unjs/fontaine#909`).
- **How Users Currently Solve This**:
  1. Using **Transfonter** (`https://transfonter.org/`) or **Font Squirrel Webfont Generator** (`https://www.fontsquirrel.com/tools/webfont-generator`) — uploads proprietary font files to a remote server, often rejects modern variable fonts, and does NOT generate CSS `size-adjust`, `ascent-override`, `descent-override`, or `line-gap-override` fallback rules.
  2. Manually running Python `fonttools` (`pyftsubset`) in terminal and hand-tuning CSS `@font-face` metric overrides by trial-and-error in Chrome DevTools.
- **Existing Products & Links**:
  - **Glyphhanger**: `https://github.com/zachleat/glyphhanger` (908★, MIT, Node CLI wrapping Python `fonttools`).
  - **Fontaine**: `https://github.com/unjs/fontaine` (2,005★, MIT, build-time Vite/Webpack plugin).
  - **Font Squirrel Webfont Generator**: `https://www.fontsquirrel.com/tools/webfont-generator` (Free legacy server-side web tool).
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: `zachleat/glyphhanger` Issue **#4** (`https://github.com/zachleat/glyphhanger/issues/4`) and Issue **#23** (`https://github.com/zachleat/glyphhanger/issues/23`) show installation and Node `child_process` breakages; Issue **#22** (`https://github.com/zachleat/glyphhanger/issues/22`) documents missing `font-weight` range generation for variable fonts.
  - **Verified Fact**: `unjs/fontaine` open Issue **#909** (`https://github.com/unjs/fontaine/issues/909`) shows unquoted multi-word font names (`Open Sans`) being split mid-name into invalid CSS (`font-family: Open, "Open fallback" Sans`).
  - **Verified Fact**: Neither Font Squirrel nor Transfonter runs locally in the browser or computes zero-CLS CSS metric overrides (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`).
- **Concrete Improvements We Provide**:
  1. **100% Client-Side OpenType Binary Parser & Subsetter**: Parses `head`, `hhea`, `OS/2`, `cmap`, `hmtx`, `fvar`, and `name` tables directly in the browser (using `opentype.js` / WASM subsetting), letting users inspect exact glyph coverage, strip unused glyph blocks or paste sample page text to whitelist exact characters, and export subsetted font binaries without uploading licensed fonts to any server.
  2. **Live Optical Overlay & Zero-CLS Fallback Calculator**: Computes exact `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` percentages against `Arial`, `Segoe UI`, `Roboto`, and `Apple System` by measuring actual character advance widths (`hmtx` table) rather than just raw `unitsPerEm`, and renders a live **Red/Blue Optical Reflow Overlay** + simulated slow-3G font swap animation proving CLS drops from `0.18` to `<0.005`.
  3. **Production `@font-face` + Next.js/Astro/CSS Bundle Exporter**: Outputs valid quoted CSS (fixing `fontaine#909`), variable font `font-weight: 100 900` ranges (fixing `glyphhanger#22`), and `unicode-range` slices.
- **Why Users Would Switch**:
  - Zero Python/Puppeteer CLI installation, zero server upload of licensed fonts, and immediate visual proof of zero-layout-shift fallback alignment.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium. OpenType table metric math (`OS/2.sTypoAscender`, `hhea.ascender`, `unitsPerEm`, average glyph advance width) is completely deterministic; binary WOFF2 compression in browser requires WASM or TrueType/OpenType table reconstruction.
  - **Main Risk**: Full WOFF2 Brotli binary encoding in pure JS can be slow on 10 MB CJK fonts; mitigated by fast TrueType/SFNT subsetting + WOFF/WOFF2 WASM encoder.
  - **Feasibility**: High.
- **MVP & Quantitative Validation**:
  - **MVP**: Drag-and-drop `.ttf`/`.otf`/`.woff` inspector (plus 4 built-in open-source fonts) → OpenType metric & variable axis analyzer → Character/Unicode-range subsetter → Interactive Red/Blue Optical CLS Overlay & Slow-3G Swap Simulator → Ready-to-copy `@font-face` CSS + subset download.
  - **Validation**: Test across 10 real fonts (serif, sans-serif, monospace, display, multi-word names, variable weight fonts), measuring real browser layout shift (`LayoutShift` PerformanceObserver API / bounding box delta in pixels) before vs. after applying the generated `@font-face` metric overrides.
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: Unmatched fallback fonts cause browser text reflow and CLS; `glyphhanger` (#22) and `fontaine` (#909) have documented CSS generation bugs.
  - *Reasonable Inference*: Designers and frontend engineers strongly prefer seeing a live red/blue typographic overlay of the fallback vs. web font before copying the CSS.
  - *Unverified Hypothesis*: Users will use the interactive glyph-subsetting matrix in the same session as the CLS fallback generator.
- **5-Dimension Scoring**:
  - **Practical Value**: **8.0/10** — High value for frontend performance and typography polish.
  - **Originality**: **8.5/10** — Visual Red/Blue optical reflow overlay + real-time CLS measurement in browser is immediately memorable.
  - **Competitive Advantage**: **8.0/10** — Faster and safer than server-upload tools (Font Squirrel) and easier than Python/Node CLIs (`glyphhanger`).
  - **User Experience**: **9.0/10** — Editorial typography workbench aesthetic with instant visual feedback.
  - **Feasibility**: **8.5/10** — Metric calculation and SFNT table parsing are 100% deterministic in browser.

---

### Direction 6: **FilterGraph Studio** — Visual FFmpeg Complex Filtergraph Builder with Live Browser Canvas Frame Preview (Creation Software & Media Tool)

- **Target Users & Concrete Pain Points**:
  - Video creators, technical podcasters, developer advocates, and media engineers who automate video/audio processing with `ffmpeg` (`-filter_complex`).
  - **Pain Point**: Writing an `ffmpeg -filter_complex` string (e.g., cropping a 16:9 screen recording to 9:16, blurring a background pad, overlaying a picture-in-picture webcam with rounded corners, burning in time-offset subtitles, and applying `loudnorm` audio normalization) requires cryptic stream labels (`[0:v]split=2[bg][fg];[bg]scale=1080:1920,boxblur=20[bgblur];[fg]crop=...;[bgblur][fg]overlay=(W-w)/2:(H-h)/2[outv]`). One typo in stream pad naming (`Output pad "default" with type video of the filter instance "Parsed_overlay_3" of overlay not connected to any destination`) or swapped `w:h:x:y` coordinate requires re-running FFmpeg in terminal and opening the output MP4 15 times in a row.
- **How Users Currently Solve This**:
  1. Guessing coordinates in terminal, running `ffmpeg -t 5 ... test.mp4`, opening VLC, noticing the crop/overlay is 40px off, and repeating 10+ times.
  2. Using **LosslessCut** (`https://github.com/mifi/lossless-cut`) — great for stream-copy trimming, but does NOT construct multi-node `-filter_complex` graphs (crop + pad + blur + PiP overlay + audio ducking/normalization).
  3. Using **ffmpeg.guide** (`https://ffmpeg.guide/`) — dead/minimal prototype with no real-time frame-accurate interactive coordinate dragging or stream-type validation.
- **Existing Products & Links**:
  - **LosslessCut**: `https://github.com/mifi/lossless-cut` (45,920★, GPL-2.0, desktop trimmer).
  - **ffmpeg.guide**: `https://ffmpeg.guide/` (Web node graph toy without interactive canvas crop/overlay manipulation or bidirectional CLI parser).
  - **FFmpeg Command Generators (e.g. `ffmpeg.lav.io`)**: Basic form dropdowns that only generate simple `-vf scale=...` flags, not DAG `-filter_complex` pipelines.
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: None of the web FFmpeg generators can **parse an existing `-filter_complex` command string back into a visual graph** (bidirectional sync) to diagnose why an existing command fails with unconnected pads or dimension mismatches (`width not divisible by 2` for `yuv420p` H.264 encoding).
  - **Verified Fact**: Existing node editors do not provide a direct manipulation **Interactive Frame Canvas** where dragging a crop box or PiP overlay updates the exact `[x:y:w:h]` filter parameters and previews the composited output at 60fps in the browser.
- **Concrete Improvements We Provide**:
  1. **Bidirectional `-filter_complex` Parser & Compiler**: Paste any complex `ffmpeg` command and it parses the stream DAG (`[0:v]`, `[1:a]`, filter chains, split/concat/overlay/amerge pads), automatically catching unconnected stream pads, audio/video type mismatches, and odd-pixel H.264 `yuv420p` dimension errors before you ever run FFmpeg.
  2. **Direct-Manipulation Frame Preview Canvas**: Drag crop handles, PiP overlay boxes, watermark anchors, and blur regions directly on a live HTML5 Video/Canvas frame (using uploaded local clips or built-in multi-stream test videos) while the `-filter_complex` syntax updates in real time.
  3. **Production Shell/Python/Batch Script Exporter**: Exports clean, escaped bash/zsh scripts, `ffmpeg-python` code, or runs directly in-browser via WebCodecs / `ffmpeg.wasm` for instant clip rendering.
- **Why Users Would Switch**:
  - Turns a 15-iteration terminal trial-and-error loop into a 10-second direct-manipulation visual adjustment with static DAG validation.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium-High. Implementing a faithful parser/validator for FFmpeg's filtergraph grammar (`;`, `,`, `[in][out]`, `key=val:key2=val2`) + synchronized 2D canvas compositor requires careful engineering.
  - **Main Risk**: FFmpeg has 400+ filters; trying to support all 400 superficially would dilute quality. Focusing deeply on the 18 core video/audio filters that account for 95% of real pipelines (`scale`, `crop`, `pad`, `overlay`, `split`, `concat`, `boxblur`, `drawtext`, `subtitles`, `trim`, `setpts`, `fps`, `loudnorm`, `afade`, `amix`, `amerge`, `volume`, `acrossfade`) keeps it rock-solid.
  - **Feasibility**: High.
- **MVP & Quantitative Validation**:
  - **MVP**: Bidirectional `-filter_complex` AST Parser & Static Validator (catching dangling pads, odd-dimension H.264 errors, `concat` stream mismatches) + Interactive 2D Frame Compositor Canvas (drag-to-crop, drag-to-overlay PiP, blur/pad/drawtext preview) + Multi-format CLI/Script exporter.
  - **Validation**: Test bidirectional round-trip parsing and static error detection against a corpus of 25 real-world StackOverflow/production `ffmpeg -filter_complex` commands (both valid pipelines and broken commands with known pad/dimension errors).
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: FFmpeg's `yuv420p` H.264 encoder fails when `scale`/`crop` produces odd pixel dimensions, and `-filter_complex` syntax fails silently or cryptically on unconnected pads.
  - *Reasonable Inference*: Direct canvas manipulation of `crop` and `overlay` coordinates eliminates terminal guess-and-check loops.
  - *Unverified Hypothesis*: Users who already know basic FFmpeg flags will prefer bidirectional text↔canvas sync over a pure node-wiring UI.
- **5-Dimension Scoring**:
  - **Practical Value**: **8.5/10** — Huge time-saver for anyone building video automation or editing via FFmpeg.
  - **Originality**: **8.5/10** — Bidirectional `-filter_complex` CLI parser + static pad/codec validator + interactive frame canvas is far beyond existing dropdown generators.
  - **Competitive Advantage**: **8.0/10** — Solves the exact bidirectional parsing and live coordinate manipulation missing from `ffmpeg.guide`.
  - **User Experience**: **9.0/10** — Broadcast NLE / dark room workbench feel with live visual canvas + synchronized code bar.
  - **Feasibility**: **8.5/10** — Scoped to the 18 core production filters, 100% deterministic in browser.

---

### Direction 7: **ActionGraph Workbench** — GitHub Actions Workflow DAG Visualizer, Matrix Fan-Out Simulator & Critical-Path Bottleneck Analyzer (Developer Productivity Tool)

- **Target Users & Concrete Pain Points**:
  - DevOps engineers, open-source maintainers, and full-stack developers maintaining `.github/workflows/*.yml` CI/CD pipelines.
  - **Pain Point**: GitHub Actions YAML files grow into 300–800 line tangled webs of `needs: [build, lint]`, `strategy.matrix`, `if: ${{ ... }}` conditions, reusable workflows, and repeated cache/setup steps. Developers cannot see the actual **Critical Path** (which job sequence determines total PR wait time), accidentally trigger 24-job matrix explosions that burn $0.008–$0.064/min macOS/Linux runner minutes, or make subtle expression/dependency mistakes that are only discovered after `git commit && git push` and waiting 5 minutes.
- **How Users Currently Solve This**:
  1. Using `rhysd/actionlint` (`https://github.com/rhysd/actionlint`) in CLI — catches syntax/type errors, but provides zero DAG critical-path visualization, matrix combination fan-out simulation, or runner minute cost/cache redundancy analysis.
  2. Running `nektos/act` (`https://github.com/nektos/act`) locally — requires downloading multi-gigabyte Docker images and still fails on many GitHub-specific contexts (`GITHUB_TOKEN`, OIDC, macOS runners).
  3. Pushing `"fix ci 1"`, `"fix ci 2"`, `"fix ci 3"` commits to a draft PR just to see what GitHub's UI renders.
- **Existing Products & Links**:
  - **actionlint**: `https://github.com/rhysd/actionlint` (4,408★, MIT, Go static checker CLI + WASM playground).
  - **nektos/act**: `https://github.com/nektos/act` (72,643★, MIT, local Docker runner).
  - **GitHub Actions Native Web UI**: Only renders the visual graph *after* you commit, push, and trigger a live workflow run.
- **Shortcomings of Existing Solutions & Verifiable Evidence**:
  - **Verified Fact**: GitHub's native workflow visualizer cannot preview a local/uncommitted YAML file, cannot simulate how `if:` conditions prune the graph under different trigger events (`pull_request` vs `push` vs `release`, fork PR vs internal branch), and does not compute critical-path latency or runner minute cost per trigger.
  - **Verified Fact**: `rhysd/actionlint` (`https://rhysd.github.io/actionlint/`) outputs flat text linter messages without DAG visualization, matrix cartesian expansion (`include`/`exclude`), or security pinning checks (unpinned third-party `@main`/`@v3` tags vs SHA pinning).
- **Concrete Improvements We Provide**:
  1. **Pre-Push Interactive DAG & Event Simulator**: Renders the exact multi-stage job & step graph before pushing, and lets you toggle simulated trigger payloads (`event_name: pull_request`, `ref: refs/heads/main`, `actor: dependabot[bot]`, `fork: true`) to see which jobs execute, skip, or deadlock when an upstream dependency is skipped without `always()`.
  2. **Matrix Cartesian Fan-Out & Runner Cost Calculator**: Expands `strategy.matrix` (`include`/`exclude`) combinations, computes total billed runner minutes across `ubuntu-latest` (1x), `windows-latest` (2x), and `macos-latest` (10x multiplier), and identifies the **Critical Path** bottleneck.
  3. **One-Click Security & Speed Refactoring**: Detects unpinned third-party actions (`uses: owner/repo@v4`), missing `permissions:` least-privilege blocks, missing `concurrency: cancel-in-progress: true` (which wastes thousands of CI minutes on rapid PR pushes), and outputs a patched YAML diff.
- **Why Users Would Switch**:
  - Eliminates the dreaded *"push 6 commits to test workflow YAML conditions and matrix exclusions"* loop while cutting CI runner bills and catching skipped-dependency deadlocks instantly in the browser.
- **Development Difficulty, Main Risks & Feasibility**:
  - **Difficulty**: Medium. Requires YAML AST parsing, GitHub Actions `${{ ... }}` expression evaluator, matrix cartesian product expansion with `include`/`exclude`, and topological DAG critical-path calculation.
  - **Main Risk**: Full emulation of custom third-party composite actions is impossible offline; mitigated by focusing on workflow-level DAG, `${{ }}` expression simulation, matrix expansion, and static security/cost optimizations.
  - **Feasibility**: High (100% browser-side TypeScript).
- **MVP & Quantitative Validation**:
  - **MVP**: YAML Editor + Multi-Workflow loader → Interactive DAG with Critical Path & Trigger Context Simulator (`push` / `pull_request` / `fork` / failure states) → Matrix Expansion & Runner Cost Estimator → Static Security/Concurrency Optimizer with one-click YAML patch diff.
  - **Validation**: Test against 20 real-world `.github/workflows/*.yml` files from popular open-source repositories, verifying matrix expansion counts, deadlock detection accuracy (when a downstream job depends on a conditionally skipped upstream job), and YAML patch validity.
- **Fact / Inference / Hypothesis Classification**:
  - *Verified Fact*: GitHub Actions charges a 10x multiplier for macOS runners and 2x for Windows; missing `concurrency.cancel-in-progress` runs duplicate obsolete workflows on every push; downstream jobs skip silently if an upstream `needs` job is skipped unless `if: always() && ...` is handled carefully.
  - *Reasonable Inference*: Simulating `if:` expressions and matrix expansion in browser saves multiple git-push cycles.
  - *Unverified Hypothesis*: Developers will use the runner-cost estimator alongside the DAG expression simulator.
- **5-Dimension Scoring**:
  - **Practical Value**: **8.0/10** — Useful for anyone maintaining non-trivial GitHub Actions workflows.
  - **Originality**: **8.0/10** — Trigger-context `if:` pruning simulation + critical-path/cost analysis + one-click YAML hardening in one workbench.
  - **Competitive Advantage**: **7.5/10** — Complements `actionlint` well, though audience is restricted to GitHub Actions users.
  - **User Experience**: **8.5/10** — Interactive pipeline graph with live event toggles.
  - **Feasibility**: **9.0/10** — Clean deterministic YAML + expression AST evaluation.

---

## 3. Phase 3: Strict Product Critique & Stress-Testing (6 Questions per Direction)

### Critique of Direction 1: **HARshield Workbench** (Structure-Preserving HAR Sanitizer & Repro Bundler)
1. **Does this product truly need to exist?**
   - **Yes.** Every week, thousands of engineers and enterprise customers are asked to attach a `.har` capture to support tickets or bug reports. Sharing raw HARs leaks active session cookies, OAuth refresh tokens, and PII; manually editing a 10 MB HAR breaks JSON syntax.
2. **Why can't existing tools solve it?**
   - Chrome's built-in sanitized HAR export ONLY scrubs top-level headers (`Cookie`, `Set-Cookie`, `Authorization`), leaving OAuth tokens, passwords, and API keys inside JSON request/response bodies (`postData.text`, `response.content.text`) completely exposed. Cloudflare's `har-sanitizer` uses regex over raw text, which fails on response bodies (`#27`), POST bodies (`#17`), nested URL query params (`#44`), and corrupts JSON validity (`#22`).
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — our proposed architecture is 100% deterministic, zero-AI, and zero-cost.** It uses recursive MIME/AST parsing (JSON-in-JSON, URL-encoded, JWT structure, cookie correlation) and HMAC/hash-based deterministic pseudonymization (`TOKEN_#1`) right in the browser. No LLM is needed or desired (sending unredacted secrets to a cloud LLM would defeat the entire security purpose!).
4. **Will users try it once and never use it again?**
   - It is an episodic utility used whenever filing or triaging a bug report / vendor support ticket (typically 1–4 times/month for an engineer, daily for support/QA teams). Adding the **Minimal Repro Bundler** (filtering 200 noisy requests down to the 3 relevant API calls and exporting a clean redacted `curl` / Playwright test / Markdown incident report) makes it useful for *internal* daily debugging as well, not just external support tickets.
5. **What evidence shows our approach is demonstrably better?**
   - We can run the exact reproduction payloads from `cloudflare/har-sanitizer` Issues #17, #22, #27, and #44 and prove mathematically that our AST-based engine outputs 100% valid JSON, redacts nested POST/response tokens, and preserves cross-request token referential integrity (`TOKEN_#1` in login response == `TOKEN_#1` in subsequent failing request header).
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If browser DevTools natively added recursive JSON-body token pseudonymization and request-chain noise filtering tomorrow, standalone HAR sanitizers would be less needed. (Verified fact: as of 2026, Chromium's HAR sanitizer strictly targets HTTP headers and does not parse nested JSON payloads or pseudonymize tokens).

---

### Critique of Direction 2: **PlanDiff Workbench** (PostgreSQL `EXPLAIN ANALYZE` Side-by-Side Tree Diff & Bottleneck Simulator)
1. **Does this product truly need to exist?**
   - **Yes.** Query optimization is inherently comparative (*Before* vs. *After*), yet the most popular open-source visualizer (`dalibo/pev2`, 3,616★) only displays a single plan at a time, leaving DBAs with 170-node plans to compare two browser tabs manually (`dalibo/pev2#428`).
2. **Why can't existing tools solve it?**
   - Text `diff` fails on `EXPLAIN ANALYZE` because every line contains changing cost/timing floats and a single join change shifts tree indentation across the entire output. Existing visualizers (`pev2`, `depesz`) parse a single tree and lack a relation-aware tree-alignment algorithm.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — our solution is 100% deterministic and non-AI.** Aligning nodes by scanned `Relation Name` / `Alias` / index target and computing exact deltas for `Actual Total Time`, `Shared Read Blocks`, `Shared Hit Blocks`, and `Rows Removed by Filter` requires tree algorithms, not an LLM.
4. **Will users try it once and never use it again?**
   - Any backend engineer tuning SQL queries or reviewing database migration PRs runs `EXPLAIN ANALYZE` repeatedly during each optimization session (often 5–10 iterations per query) and needs a clean before/after table to paste into their GitHub Pull Request description.
5. **What evidence shows our approach is demonstrably better?**
   - Directly resolves `dalibo/pev2` Issues #377, #428, #687, #689, and #874, reducing the time to locate scan/join transitions and buffer regressions across two multi-node plans from minutes of tab-switching to 1 second.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If query optimization shifts alter the plan tree so drastically that neither subtree alignment nor relation/alias alignment can match corresponding scans between Plan A and Plan B, the visual diff would degrade into two separate trees. (However, because SQL queries reference explicit tables/aliases, relation-level scan alignment is guaranteed to anchor the leaf nodes even when join order flips completely).

---

### Critique of Direction 3: **SVGcraft Workbench** (Multi-Icon SVG Sanitizer, ID De-Collider & Keyframe Path Morph Studio)
1. **Does this product truly need to exist?**
   - **Yes.** Design-to-code handoff for SVG icons regularly causes silent production bugs (colliding `#clip0` / `#paint0_linear` IDs across inline icons on the same page, broken `currentColor` inheritance, and incompatible vertex counts when morphing icon states).
2. **Why can't existing tools solve it?**
   - SVGOMG processes one SVG in isolation (cannot simulate multi-icon DOM collisions on a shared page), still lacks a dedicated `currentColor` workflow (`svgomg#173`), and cannot normalize two SVG paths (`State A` ↔ `State B`) to have matching cubic Bezier segment counts for CSS/React morphing.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — 100% deterministic computational geometry** (affine matrix baking into path coordinates, AST ID hashing, and De Casteljau cubic Bezier subdivision). Zero AI required.
4. **Will users try it once and never use it again?**
   - Frontend developers and UI designers add or tweak icons and micro-interactions in almost every feature sprint.
5. **What evidence shows our approach is demonstrably better?**
   - Resolves `svg/svgo#674` (multi-SVG ID collision), `svg/svgo#624` (transform flattening), and `jakearchibald/svgomg#173` (`currentColor`), while producing 60fps CSS `d: path(...)` transitions between shapes that natively fail to morph in Chrome/Safari.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If teams exclusively use pre-packaged icon libraries (like `lucide-react`) and never import custom SVGs from Figma or animate custom SVG states, they wouldn't need an SVG workbench. (In practice, custom brand icons, status badges, and animated toggles remain ubiquitous).

---

### Critique of Direction 4: **ContractGuard Workbench** (OpenAPI Breaking-Change Diff & Payload Replay Simulator)
1. **Does this product truly need to exist?**
   - **Yes.** API breaking changes cause severe production incidents, and existing CLI diff tools struggle with `allOf` compositions (`oasdiff#1383`) and don't show concrete payload failures.
2. **Why can't existing tools solve it?**
   - `oasdiff` and `openapi-changes` operate as static schema rule checkers without an interactive payload simulator that replays v1 JSON payloads against the effective dereferenced v2 schema.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — deterministic schema dereferencing + JSON Schema validation.**
4. **Will users try it once and never use it again?**
   - High risk that teams prefer running OpenAPI checks exclusively inside automated GitHub Actions CI rather than pasting two large YAML files into a browser workbench.
5. **What evidence shows our approach is demonstrably better?**
   - Fixes the `allOf` + `additionalProperties: false` blind spot (`oasdiff#1383`) and `$ref` sibling `x-sunset` check (`oasdiff#1361`) while generating concrete failing JSON payload examples.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If developers refuse to paste two OpenAPI YAML files into a browser UI because their specs are split across 50 local `$ref` files on disk, a browser workbench becomes inconvenient compared to a CLI.

---

### Critique of Direction 5: **FontShift Zero** (Browser-First Web Font Subsetter & Zero-CLS Metric Override Workbench)
1. **Does this product truly need to exist?**
   - **Yes.** Custom web fonts remain one of the top causes of poor Core Web Vitals (CLS) and bloated initial page weight.
2. **Why can't existing tools solve it?**
   - CLI tools like `glyphhanger` break on Puppeteer installation (`#4`) and variable fonts (`#22`); build plugins like `fontaine` break on unquoted multi-word font names (`#909`) and offer no visual optical alignment tuning or character subsetting UI.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — deterministic OpenType binary table parsing (`OS/2`, `hhea`, `hmtx`, `cmap`) in browser.**
4. **Will users try it once and never use it again?**
   - Typography setup typically happens **once per project** (at the start of building a site). While very useful in that moment, per-user frequency is lower than query debugging, SVG icon handoff, or bug-report sanitization.
5. **What evidence shows our approach is demonstrably better?**
   - Quantifiable CLS reduction (measured via browser layout shift metrics) and file-size reduction (`KB` saved) in seconds without server uploads.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If `next/font` automatic Google Fonts optimization covers 90% of users and only users with self-hosted `.ttf`/`.otf` commercial fonts need manual metric overrides and subsetting, the addressable audience is smaller.

---

### Critique of Direction 6: **FilterGraph Studio** (Visual FFmpeg Complex Filtergraph Builder & Frame Previewer)
1. **Does this product truly need to exist?**
   - **Yes.** Writing multi-stream `ffmpeg -filter_complex` commands by hand in a terminal is notoriously error-prone.
2. **Why can't existing tools solve it?**
   - Existing web generators only output trivial 1-flag commands and cannot parse an existing `-filter_complex` string back into a visual canvas or validate stream pad types and H.264 even-dimension constraints.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — deterministic grammar parsing + HTML5 Canvas 2D compositing.**
4. **Will users try it once and never use it again?**
   - Media engineers and creators building video pipelines reuse and tweak filtergraphs regularly.
5. **What evidence shows our approach is demonstrably better?**
   - Bidirectional CLI↔Canvas synchronization + static pad/codec error catching before running FFmpeg.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - HTML5 Canvas 2D preview can faithfully approximate geometric and visual filters (`crop`, `scale`, `pad`, `overlay`, `boxblur`, `drawtext`, `subtitles`), but cannot perfectly match every proprietary pixel-format quirk of `libavfilter` without running `ffmpeg.wasm` (which adds ~25 MB WASM payload overhead).

---

### Critique of Direction 7: **ActionGraph Workbench** (GitHub Actions DAG, Matrix & Critical-Path Simulator)
1. **Does this product truly need to exist?**
   - **Yes.** Debugging complex `.github/workflows/*.yml` `if:` conditions and `matrix` explosions via `git push` trial-and-error wastes hours and CI budget.
2. **Why can't existing tools solve it?**
   - `actionlint` is a text-only linter; `nektos/act` requires heavy local Docker execution and cannot quickly simulate 5 different event contexts (`fork PR`, `release tag`, `upstream skipped`) or compute critical-path runner costs in 1 second.
3. **Is there a simpler, cheaper, non-AI solution?**
   - **Yes — YAML AST + GitHub expression evaluator + DAG critical-path math.**
4. **Will users try it once and never use it again?**
   - Used whenever editing CI workflows or auditing CI runner spend.
5. **What evidence shows our approach is demonstrably better?**
   - Instant visual simulation of skipped-dependency deadlocks (`needs` without `always()`) and matrix cost fan-out.
6. **Which key assumption, if wrong, means we should abandon this idea?**
   - If workflows rely heavily on external reusable workflows (`uses: org/repo/.github/workflows/reusable.yml@main`) located in private repositories, a single-file browser workbench cannot inspect the inner steps of those external private workflows without additional pasting.

---

## 4. Phase 4: Comparison Table, Recommendations & Risk Analysis

### 4.1 Candidate Directions Comparison Table

| # | Candidate Direction | Category | Practical Value (10) | Originality (10) | Competitive Edge (10) | UX & Workbench Feel (10) | Feasibility (10) | **Weighted Total (50)** | Key Evidence / Validated Gap |
|---|---|---|---|---|---|---|---|---|---|
| **1** | **HARshield Workbench** (Structure-Preserving HAR Sanitizer & Repro Bundler) | Dev & Support Productivity | **9.0** | **8.5** | **9.0** | **9.0** | **9.5** | **45.0 / 50** | Fixes `cloudflare/har-sanitizer` `#17`, `#22`, `#27`, `#44` + Chrome's header-only blind spot |
| **2** | **PlanDiff Workbench** (PostgreSQL `EXPLAIN ANALYZE` Tree Diff & Bottleneck Simulator) | Developer Tool (Database) | **9.0** | **9.0** | **8.5** | **8.5** | **9.0** | **44.0 / 50** | Directly solves `dalibo/pev2` `#377`, `#428` (comparing 2 plans) + `#687`, `#689`, `#874` |
| **3** | **SVGcraft Workbench** (Multi-Icon SVG Sanitizer, ID De-Collider & Path Morph Studio) | Creation & Frontend Tool | **8.5** | **8.5** | **8.0** | **9.5** | **9.0** | **43.5 / 50** | Solves `svg/svgo` `#674` (ID collisions), `#624` (transforms), `svgomg` `#173` (`currentColor`) + CSS path morphing |
| **6** | **FilterGraph Studio** (Bidirectional FFmpeg `-filter_complex` Visual Canvas) | Creation & Media Tool | **8.5** | **8.5** | **8.0** | **9.0** | **8.5** | **42.5 / 50** | Bidirectional `-filter_complex` DAG parser + static pad/codec validator + live frame crop/overlay canvas |
| **4** | **ContractGuard Workbench** (OpenAPI 3.0/3.1 `allOf` Diff & Payload Replay Simulator) | Developer Tool (API) | **8.5** | **8.0** | **8.0** | **8.0** | **9.0** | **41.5 / 50** | Fixes `oasdiff` `#1383` (`allOf` flattening), `#1361` (`x-sunset`), `#1403` + live payload replay |
| **5** | **FontShift Zero** (Browser Web Font Subsetter & Zero-CLS Metric Override Workbench) | Creation & Web Perf Tool | **8.0** | **8.5** | **8.0** | **9.0** | **8.5** | **42.0 / 50** | Fixes `glyphhanger` `#22`, `fontaine` `#909` + live Red/Blue optical CLS reflow overlay |
| **7** | **ActionGraph Workbench** (GitHub Actions DAG, Matrix & Critical-Path Simulator) | DevOps Productivity | **8.0** | **8.0** | **7.5** | **8.5** | **9.0** | **41.0 / 50** | Pre-push `if:` trigger simulator, skipped-dependency deadlock detector & runner cost analyzer |

---

### 4.2 Top Recommendations & Alignment with Silicon Valley Buildathon

The Silicon Valley Buildathon specifically rewards projects that feel like a **tactile, high-utility workbench** (*"Maybe it’s a browser tool that saves ten clicks... Show us the moment the project comes to life. Let us see someone use it, walk us through a choice you made, and tell us what changed after your first test"*):

1. **Primary Recommendation — Direction 1: HARshield Workbench (45.0/50)**
   - **Why it stands out**: Every developer and judge has used Chrome DevTools Network tab and knows the dread of sharing a `.har` file without leaking cookies, JWTs, OAuth refresh tokens in JSON responses, or signed S3 URLs. We have **irrefutable GitHub Issue evidence** against Cloudflare's own `har-sanitizer` (`#17`, `#22`, `#27`, `#44`) showing that regex replacement corrupts JSON and misses response/POST bodies.
   - **Why it wins on "Demo and Iteration"**: In Stage 3.5 validation, we can benchmark our AST-based engine directly against the regex approach on real complex HAR traces (OAuth token flows, GraphQL mutations, presigned URLs in JSON responses, malformed escapes), proving 100% JSON validity, 100% nested secret detection, and deterministic pseudonymization (`JWT_TOKEN_#1` preserved across Request & Response so auth bugs remain debuggable!).
2. **Runner-Up Recommendation (Developer Deep-Tech) — Direction 2: PlanDiff Workbench (44.0/50)**
   - **Why it stands out**: Directly answers the verbatim plea in `dalibo/pev2#428` (*"We have more and more customers asking us why this plan is better than another one... I have no other choice right now, I would love to compare trees"*). Comparing *Before Index* vs *After Index* `EXPLAIN (ANALYZE, BUFFERS)` plans side-by-side with relation alignment, buffer I/O deltas, and one-click GitHub PR benchmark tables is immediately valuable to every backend engineer.
3. **Runner-Up Recommendation (Visual/Creation Tool) — Direction 3: SVGcraft Workbench (43.5/50)**
   - **Why it stands out**: If you prefer a visual creation/frontend tool, demonstrating 5 Figma SVGs breaking on a single page due to `#clip0`/`#paint0` collisions (`svgo#674`), fixing them in one click, baking matrix transforms (`svgo#624`), and live-morphing two incompatible icon paths at 60fps makes an unforgettable visual demo.

### 4.3 Summary of Risks Across Directions
- **Direction 1 (HARshield)**: Risk of false negatives on non-standard custom secret keys; mitigated by combining structural key/token parsers (JWT, Bearer, Basic, OAuth JSON keys, URL signatures, email/IP patterns, Shannon entropy) with interactive one-click field redaction and a live Before/After JSON diff inspector.
- **Direction 2 (PlanDiff)**: Risk of tree topology shifts when PostgreSQL reorders multi-table joins; mitigated by dual alignment modes (**Relation/Scan Alignment** which always matches 100% by table/alias + **Tree Topology Alignment**).
- **Direction 3 (SVGcraft)**: Risk of self-intersecting twists when morphing paths with different winding orders or multiple disconnected subpaths (`M...Z M...Z`); mitigated by subpath pairing, winding normalization, and rotational start-vertex optimization.
- **Direction 4 (ContractGuard)**: Risk of circular `$ref` loops in deeply nested OpenAPI schemas; mitigated by cycle-safe graph memoization.
- **Direction 5 (FontShift Zero)**: Risk of slow binary processing on huge CJK fonts; mitigated by fast SFNT table parsing and scoped subsetting.
- **Direction 6 (FilterGraph Studio)**: Risk of users pasting obscure FFmpeg filters outside the core set; mitigated by clear support for the 18 most-used production filters and graceful pass-through nodes for unknown filters.
- **Direction 7 (ActionGraph)**: Risk of external private reusable workflows not being inspectable from a single YAML file; mitigated by focusing on single-file DAG, matrix fan-out, and `${{ }}` expression simulation.

---

## 5. Phase 5: Confirmed Human Selection & Product Specification

- **Confirmed Human Decision**: **Direction 1 — HARshield Workbench** (*Structure-Preserving HAR & Network Trace Sanitizer + Minimal Repro Bundler*).

### 5.1 Product Goal & Value Proposition
**HARshield Workbench** is a 100% client-side, zero-egress browser workbench that transforms raw `.har` (HTTP Archive 1.2) captures into structure-valid, cryptographically pseudonymized, noise-filtered diagnostic bundles ready to attach to vendor support tickets (Cloudflare, Okta, Stripe, AWS) or GitHub issues without leaking live session cookies, OAuth refresh/access tokens, API keys, presigned S3 signatures, or PII.

Unlike Chrome 130+'s header-only sanitizer or Cloudflare's regex-based `har-sanitizer` (which fails on Issues `#17`, `#22`, `#27`, `#44`), **HARshield Workbench**:
1. **Recursively Parses Nested ASTs (`JSON-in-HAR`, `x-www-form-urlencoded`, Multipart, GraphQL variables, JWT claims, and embedded URLs)**: Never runs blind regex over raw file text; guarantees 100% valid JSON on export and recalculates `bodySize` / `content.size` and `Content-Length` headers accurately.
2. **Preserves Cross-Request Referential Integrity via Deterministic Pseudonymization**: Maps identical secret values across multiple requests and responses to deterministic session aliases (e.g., `JWT_TOKEN_#1 [alg:HS256, sub:USER_#1, exp:2026-12-01]`, `OAUTH_REFRESH_#1`, `PRESIGNED_SIG_#1`) using an in-memory session salt. Engineers can still prove whether Request #4 sent the exact token returned by Login Response #1—or a stale token—without exposing a single byte of the real credential.
3. **Isolates the Failing Request Chain & Exports Reproducible Artifacts**: Strips out static asset/analytics noise (90%+ of typical HAR bulk) and exports:
   - Guaranteed-valid `.sanitized.har`
   - Redacted `curl` command chain
   - Redacted Playwright API reproduction script (`repro.spec.ts`)
   - Self-contained Markdown Incident Report with Redaction Audit Summary

### 5.2 Core User Workflow
1. **Ingest Trace**: Drop a `.har` file onto the local-only workbench or load one of the 4 built-in realistic diagnostic traces (*OAuth Token Refresh & 401 Race Bug*, *S3 Presigned Upload & GraphQL Leak*, *Form-Encoded Password + Cookie Session Spill*, *Cloudflare `#22`/`#44` Escape-Sequence Stress Trace*).
2. **Automatic Deep AST Inspection & Pseudonymization**: The engine parses all entries, recursively traverses headers, cookies, query strings, `request.postData`, and `response.content`, identifies secrets/PII across 10+ structural & entropy detectors, and generates a live **Redaction Audit Ledger** and **Token Correlation Graph**.
3. **Interactive Workbench Controls**:
   - Filter waterfall entries (e.g., *Hide Static Assets & Telemetry*, *Errors & Auth Flow Only*, or toggle individual entries).
   - Inspect any request/response in the **Side-by-Side AST Diff Inspector** (Raw vs. Sanitized) and click any custom JSON key/path or header to toggle or force redaction.
   - Switch redaction mode per category: **Referential Pseudonym (`TOKEN_#1`)**, **Format-Preserving Mask**, or **Strict `[REDACTED]`**.
4. **Verify & Export**: Run the built-in **Zero-Leak & JSON Integrity Verifier** (proving valid JSON parse, 0 residual raw secrets, and preserved correlation), then export `.sanitized.har`, `curl`, Playwright test, or Markdown bug report.

