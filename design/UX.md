# UX Contract — HARshield Workbench

> This file is the mandatory frontend acceptance contract for **HARshield Workbench** (*Structure-Preserving HAR Network Trace Sanitizer & Minimal Repro Bundler*). Every component, state, token, and responsive rule specified here must be verifiable in the rendered DOM.

## 1. Product

- **One-liner**: 100% client-side, structure-preserving HAR 1.2 sanitizer and minimal bug-reproduction bundler with cross-request referential pseudonymization.
- **Primary user**: Software engineers, QA/SDETs, SREs, and enterprise customers asked to attach a browser `.har` capture or `curl` reproduction to a vendor support ticket (Cloudflare, Okta, Stripe, AWS) or GitHub issue.
- **Job to be done**: Strip every live credential (Cookies, Authorization headers, OAuth `access_token`/`refresh_token` inside JSON request/response bodies, JWT payload PII, presigned URL signatures like `X-Amz-Signature`, and form passwords) and background telemetry noise from a `.har` capture in under 30 seconds—while guaranteeing 100% valid JSON output and preserving token correlation (`BEARER_TOKEN_#1` in Login Response == `BEARER_TOKEN_#1` in subsequent `401` Request).
- **Core success action**: Click **"Export Sanitized HAR & Repro Bundle"** after verifying the Zero-Leak Integrity Badge (`0 Exposed Secrets · 100% Valid JSON · Referential Aliasing Active`).
- **What the user should never have to guess**:
  1. **Whether their file is uploaded to a server**: A permanent top-bar **Zero-Egress Airlock Indicator** (`LOCAL MEMORY ONLY · 0 B NETWORK EGRESS · CSP CONNECT-SRC 'NONE'`) confirms all parsing happens in-browser.
  2. **Whether nested JSON/POST/Response secrets were caught**: The **AST Redaction Ledger** explicitly breaks down secrets found in `Headers`, `Cookies`, `Query Strings`, `Nested JSON Request Bodies`, `Nested JSON Response Bodies`, `JWT Claims`, and `Embedded Signed URLs`.
  3. **Whether redaction broke JSON syntax or token debugging**: A live **JSON AST Integrity Check** (`JSON.parse() Verified`) and **Token Lineage Badge** (`BEARER_TOKEN_#1` linked across entries `#1 → #3 → #4`) are visible before export.

## 2. Core flow

| # | Step | User action | System feedback | Next step is obvious? |
|---|---|---|---|---|
| 1 | **Load HAR Trace** | Drop a `.har` file onto the Airlock Dropzone, paste raw HAR JSON, or click one of the **4 Built-in Forensic Presets** (e.g., *OAuth Refresh & 401 Race Trace*, *Cloudflare #17/#22/#27/#44 Torture Trace*) | Within 100ms, parses the HAR 1.2 AST, recursively scans nested MIME bodies (`application/json`, `x-www-form-urlencoded`, JWTs, embedded URLs), highlights redacted tokens in Emerald and any unredacted custom overrides in Crimson, and populates the Waterfall + AST Diff Inspector | Yes — the active entry and Redaction Summary Banner immediately display the audit results and primary export button |
| 2 | **Inspect, Filter & Customize** | Toggle **"Strip Noise (Keep Auth & Failing Chain Only)"**, inspect the **Before (Raw) vs. After (Sanitized) AST Diff**, or click any field/token in the JSON tree to toggle redaction or switch mode (*Referential Alias `TOKEN_#1`* vs. *Strict `[REDACTED]`*) | Waterfall updates entry count & byte reduction (e.g., `14 entries → 4 core entries (-82% size)`), Diff view highlights exact byte/token transformations, and the **Token Lineage Ribbon** highlights every request/response sharing the selected pseudonym | Yes — primary CTA **"Export Sanitized HAR (.har)"** and quick tabs for **`curl` / Playwright / Incident Markdown** stay pinned in the workbench action bar |
| 3 | **Verify & Export** | Click **"Export Sanitized HAR"** (or copy the generated `curl` / Playwright `.spec.ts` / Markdown Bug Report) | Runs final `JSON.parse()` + Zero-Leak verification, triggers instant file download or clipboard copy, and shows a confirmation banner with SHA-256 digest and redaction count | Yes — user can immediately attach the file or reset the airlock memory |

Target: **≤ 3 steps** and **≤ 30 seconds** from landing to verified, sanitized export.

## 3. Pages & Workbench Architecture

HARshield is a focused, single-screen **Forensic Protocol Workbench** (no marketing fluff pages, no fake login walls, no multi-page maze).

| Page / View | Purpose | Primary action | Secondary actions |
|---|---|---|---|
| **Main Forensic Workbench (`/`)** | Ingest `.har` capture, audit recursive AST redactions across waterfall entries, verify referential token lineage, and export clean reproduction artifacts | **Export Sanitized HAR & Repro Bundle** (pinned top-right primary CTA) | Load Preset Trace / Upload `.har`, Toggle Noise Filter, Switch Inspector Tab (*Side-by-Side AST Diff*, *Redaction Rule & Field Matrix*, *Cross-Request Token Lineage*, *Repro Code Generator: cURL / Playwright / Markdown*), Click-to-Redact any JSON node |

One primary action dominates the screen: **Sanitize & Export Verified Bundle**.

## 4. Required states

Every view and interactive station implements all 7 required states:

- [x] **Empty / First Visit State**: When no HAR is loaded (or after clicking *"Clear Airlock"*), displays an actionable **Forensic Intake Bay** explaining how to export a `.har` from Chrome/Firefox DevTools, a drag-and-drop file target, a raw JSON paste drawer, and **4 one-click Diagnostic Preset Traces** so first-time visitors and hackathon judges can test immediately in 1 click without needing a local `.har` file on disk.
- [x] **Loading / AST Parsing State**: Shows a deterministic progress indicator (`Parsing HAR 1.2 AST → Unwrapping nested JSON/Form payloads → Computing HMAC session pseudonyms → Validating output JSON`) with zero dead UI.
- [x] **Success / Verified Zero-Leak State**: Displays the **Emerald Integrity Seal** (`100% VALID HAR JSON · N SECRETS PSEUDONYMIZED · 0 RAW LEAKS`), byte-size delta, and one-click export confirmation toast with SHA-256 checksum.
- [x] **Error State (Corrupted / Non-HAR File)**: If a user uploads a truncated `.har`, binary image, or malformed JSON, displays a structured **Forensic Parse Diagnostic Card** showing the exact line/column syntax error, why it failed, and two recovery actions: *"Attempt Auto-Repair of Truncated HAR Entries"* or *"Load Sample Trace"*.
- [x] **Invalid Input State**: If a user enters an invalid custom regex pattern or empty JSON key in the Custom Redaction Rule bar, highlights the exact input border in Crimson (`#EF4444`) with an inline diagnostic message (`Invalid regular expression: unterminated group at index 4`) without crashing the workbench.
- [x] **Privacy / Local-Only Guarantee State (Replaces Signed-Out State)**: Displays an interactive **Zero-Egress Security Audit Modal/Badge** proving 0 external network calls (`window.fetch` / `XMLHttpRequest` network monitor counter = `0 outbound requests`).
- [x] **Mobile 390px Layout**: Responsive stacked workbench where Waterfall List, Before/After Diff Inspector, Token Lineage, and Export Drawer switch cleanly via a sticky bottom/top segmented bar with ≥44px touch targets and zero horizontal viewport overflow.

## 5. Design tokens

- **Font family and scale**:
  - **UI & Technical Headers**: `'Space Grotesk', 'IBM Plex Sans', system-ui, sans-serif`
    - App Title / Workbench Header: `16px` (`font-weight: 700`, tracking `-0.02em`)
    - Section / Panel Header: `12px` uppercase (`font-weight: 600`, tracking `0.08em`)
    - Body / Control Label: `13px` (`font-weight: 500`, line-height `1.45`)
  - **Protocol / Waterfall / JSON AST / Diff Monospace**: `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace`
    - Code / JSON AST / Headers: `12px` (`line-height: 1.55`, tabular-nums)
    - Badges / Status Pills / Metrics: `11px` (`font-weight: 600`, tabular-nums)
- **Spacing scale**: High-density 4px grid (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`). Panel padding `12px–16px`; table row height `32px` (desktop), `44px` (mobile touch).
- **Colors (Dark Forensic Analyzer Palette)**:
  - **Background Primary (Canvas)**: `#0A0D12` (Deep Carbon Obsidian)
  - **Background Secondary (Panels / Headers)**: `#11161F` (Anodized Slate)
  - **Background Tertiary (Elevated / Hover / Active Row)**: `#18202C` (Machined Steel)
  - **Border / Hairline Divider**: `#232E3F` (`1px solid` crisp structural grid lines)
  - **Text Primary**: `#F1F5F9` (High-contrast Alabaster)
  - **Text Muted / Secondary**: `#94A3B8` (Technical Slate)
  - **Accent Primary (Protocol Cyan / Interactive Focus)**: `#06B6D4` (Oscilloscope Cyan)
  - **Success / Pseudonymized Safe Token**: `#10B981` (Verified Emerald, surface tint `rgba(16, 185, 129, 0.14)`)
  - **Warning / Structural Redaction / Noise Filter**: `#F59E0B` (Signal Amber, surface tint `rgba(245, 158, 11, 0.14)`)
  - **Danger / Raw Unredacted Secret in "Before" View**: `#EF4444` (Forensic Crimson, surface tint `rgba(239, 68, 68, 0.16)`)
- **Radius and borders**: Sharp technical radii (`4px` for badges/inputs, `6px` for panels), `1px solid #232E3F` structural hairlines. No pillowy `24px` rounded SaaS cards or blurry drop shadows.
- **Button and input height**: Desktop interactive controls `34px–38px`; Primary CTAs and all Mobile (`≤768px`) interactive touch targets strictly `≥ 44px` height.
- **Icon style and stroke**: Crisp `1.75px` stroke inline SVG technical iconography (`lucide-react`), always paired with explicit text labels (zero unlabeled icon-only buttons).

## 6. References

| Reference | What to borrow | What not to copy |
|---|---|---|
| **Chrome DevTools Network Panel & HAR Viewer** (`developer.chrome.com/docs/devtools/network`) | Split-pane architecture: left/top compact request waterfall table (`Method`, `Status`, `Domain/Path`, `MIME`, `Secrets Found` badge) paired with right/bottom tabbed payload inspector | Do not copy Chrome's hidden 3-dot menu burial of HAR export or header-only sanitization blindness |
| **mitmproxy Web Interface** (`github.com/mitmproxy/mitmproxy`) | High-contrast HTTP method/status coloring, instant filter bar (`Errors & Auth Only`, `Hide Static Noise`), and structured decoding of URL-encoded / JSON bodies | Do not require a local Python proxy server or terminal daemon |
| **GitHub Split Unified Code Diff & Dalibo PEV2** (`github.com/dalibo/pev2`) | Synchronized Before (Raw Crimson) vs. After (Sanitized Emerald) token-level diff highlighting and structural metric pills | Do not use single-view-only inspection where users can't see what changed |

## 7. Mobile (390px Layout)

- **390px layout**:
  - Top bar compacts into a two-row header: Brand + `0 Egress` badge on row 1; Preset Selector + Primary **"Export .HAR"** CTA (`min-height: 44px`) on row 2.
  - Main workspace uses a sticky 3-way Mobile Mode Switcher (`1. Requests (N)`, `2. AST Diff & Redact`, `3. Repro & Lineage`) so the user never deals with crushed side-by-side columns on a 390px screen.
- **Primary action reachable without horizontal scroll**: `overflow-x: hidden` on root container; JSON diff lines wrap with `word-break: break-all` / `overflow-wrap: anywhere` so horizontal scrolling is never required.
- **What is collapsed or hidden**: Secondary timing waterfall bars and verbose MIME columns collapse into compact metadata pills inside each request card on 390px.
- **Keyboard behavior**: Filter search input and custom field rule input support `Enter` to apply and `Escape` to clear without trapping focus.

## 8. Visual direction

- **Three adjectives**: **Forensic, Deterministic, High-Density**.
- **Product archetype**: **Editor / Terminal Protocol Workbench** (an industrial network packet & AST security airlock).
- **Palette and why it fits the domain**: Deep Carbon Obsidian (`#0A0D12`) and Anodized Slate (`#11161F`) with `1px` structural grid hairlines (`#232E3F`) evoke hardware logic analyzers, Wireshark, and mission-critical security tooling. Semantic highlights are reserved strictly for data state: **Forensic Crimson (`#EF4444`)** marks raw exposed credentials in the *Before* pane; **Verified Emerald (`#10B981`)** marks deterministically pseudonymized aliases (`JWT_TOKEN_#1`) in the *After* pane; **Signal Amber (`#F59E0B`)** marks stripped noise and structural body-length recalculations; **Oscilloscope Cyan (`#06B6D4`)** marks active selection and cross-request lineage links.
- **Type pairing (max 2 families)**: `Space Grotesk` (technical geometric sans for panel headers and controls) + `JetBrains Mono` (tabular monospace for HTTP methods, status codes, byte deltas, JSON AST trees, and `curl`/Playwright output).
- **Density**: **Dense** — engineers inspecting a 20-request HAR trace need to see request sequence, HTTP status codes, secret categories (`Header`, `Cookie`, `JSON Body`, `Response Token`, `Presigned URL`), and the exact Before/After JSON payload diff in a single unified viewport without scrolling past giant hero banners.
- **Signature element (one thing this product owns)**:
  - **The Synchronized Dual-AST Redaction Diff & Referential Token Lineage Ribbon**:
    1. Side-by-side **Raw Exposure (Crimson)** vs **Sanitized Output (Emerald)** JSON/HTTP inspector where every detected credential shows its exact AST location (`entries[0].response.content.text → $.refresh_token`) and why competitor regex tools miss it.
    2. Clicking or hovering any pseudonym (e.g., `BEARER_TOKEN_#1` or `OAUTH_REFRESH_#1`) illuminates a **Cross-Request Lineage Ribbon** across the waterfall showing every request and response where that exact secret appeared (`Login 200 OK [Issued] → Profile 200 OK [Used] → Billing 401 Unauthorized [Stale Token #2 Used!]`), proving that auth bugs remain 100% debuggable after sanitization.
- **Motion rules**:
  - **What animates**: `<120ms` crisp opacity/border transitions when switching requests or toggling redaction rules; subtle pulse on the `0 Raw Leaks Verified` badge when re-verifying AST integrity.
  - **What never animates**: No floating 3D objects, no bouncing cards, no typewriter text delays, no decorative background particles.
- **Rejected clichés**: Purple/indigo gradients, glassmorphism blur cards, centered marketing hero + 3 feature cards, generic KPI dashboard sidebars, emoji icons, Lorem ipsum text.

**Generic test:** Could this first screen be dropped into a generic SaaS CRM or AI chatbot without looking out of place? **No** — the top protocol airlock telemetry strip, the multi-entry HTTP waterfall with per-layer secret counters (`HDR` / `CKIE` / `POST-JSON` / `RESP-JSON` / `URL-SIG`), the synchronized Crimson/Emerald Dual-AST Diff, and the Referential Token Lineage Ribbon are unmistakably purpose-built for network trace sanitization.

## 9. UX acceptance

- [x] A first-time user can explain the product's purpose within 5 seconds
- [x] The core task is reachable from the landing page without reading docs (1-click preset traces + drag-and-drop right in the workbench)
- [x] Every action produces visible feedback within 100ms, or a loading state
- [x] Every error says what happened and what to do next (including malformed HAR auto-repair)
- [x] Empty states are actionable, not blank (Forensic Intake Bay with 4 instant diagnostic presets)
- [x] No dead ends; no unlabeled icon-only buttons
- [x] Desktop (1440px) and mobile (390px) screenshots reviewed side by side
- [x] The flow still works after connecting the real recursive AST sanitization engine
