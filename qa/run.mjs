// Real-browser QA runner for HARshield Workbench (Stage 3 QA)
// Based on ~/.config/opencode/skills/playwright-qa/template.mjs
//
// Run:
//   BASE_URL=https://georgefifth.github.io/harshield-workbench/ node qa/run.mjs
//   BASE_URL=http://127.0.0.1:4488/ node qa/run.mjs

import { chromium, firefox } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4488/";
const OUT = process.env.QA_OUT ?? "evidence/stage-3-qa";
const BROWSER = process.env.BROWSER === "chromium" ? "chromium" : "firefox";
const HEADED = process.env.HEADED === "1";

const SHOTS = path.join(OUT, "screens");
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
];

const scenarios = [
  {
    id: "S1-first-visit-and-airlock",
    title: "First visit, Zero-Egress Airlock modal, Escape dismissal & Empty State Intake recovery",
    async run(page, ctx) {
      await page.goto(BASE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      await ctx.expectVisible('[data-testid="integrity-seal-card"]');
      ctx.assert((await page.title()).includes("HARshield Workbench"), "Unexpected document.title");

      // Check zero horizontal overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      ctx.assert(overflow <= 1, `horizontal overflow detected: ${overflow}px`);

      // Verify initial OAuth 401 Race preset telemetry
      await ctx.expectText(/21 Secrets Redacted/i);
      await ctx.expectText(/JSON\.parse\(\) PASS/i);
      await ctx.shot("01-landing-workbench");

      // Open Airlock Zero-Egress modal & dismiss with Escape key
      await page.getByTestId("airlock-status-badge").click();
      await ctx.expectVisible('[data-testid="airlock-security-banner"]');
      await ctx.expectText(/ZERO-EGRESS BROWSER SANDBOX VERIFIED/i);
      await page.keyboard.press("Escape");
      const bannerCount = await page.locator('[data-testid="airlock-security-banner"]').count();
      ctx.assert(bannerCount === 0, "Airlock modal did not close on Escape key");

      // Click Clear Airlock -> verify Empty Intake State -> restore via 1-click preset
      await page.getByTestId("clear-airlock-btn").click();
      await ctx.expectVisible('[data-testid="empty-intake-state"]');
      await ctx.expectText(/Drop a Browser/i);
      await ctx.shot("02-empty-intake-bay");

      await page.getByTestId("empty-preset-oauth-401-race").click();
      await ctx.expectVisible('[data-testid="integrity-seal-card"]');
      await ctx.expectText(/21 Secrets Redacted/i);
    },
  },
  {
    id: "S2-core-sanitization-and-lineage",
    title: "End-to-end AST Sanitization, Dual-AST Diff & Referential Token Lineage (401 RACE)",
    async run(page, ctx, vpName) {
      await page.goto(BASE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      await ctx.expectVisible('[data-testid="token-lineage-ribbon"]');

      // Click JWT_TOKEN_#1 lineage pill to highlight cross-request occurrences
      await page.getByTestId("lineage-pill-JWT_TOKEN_#1").click();

      // Click Entry #6 (index 5: 401 Unauthorized) in waterfall
      await page.getByTestId("waterfall-entry-5").click();

      if (vpName === "mobile") {
        // On mobile 390px, switch to 2. AST Diff station to inspect Dual-AST Diff
        await page.getByRole("button", { name: /2\. AST Diff/i }).click();
      }

      await ctx.expectVisible('[data-testid="dual-ast-diff-view"]');
      const afterPaneText = await page.getByTestId("sanitized-after-pane").textContent();
      ctx.assert(
        afterPaneText.includes("Bearer JWT_TOKEN_#1"),
        "Sanitized After pane missing Bearer JWT_TOKEN_#1 alias"
      );
      ctx.assert(
        !afterPaneText.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
        "Raw JWT leaked in Sanitized After pane!"
      );
      ctx.assert(
        !afterPaneText.includes("DE89370400440532013000"),
        "Raw IBAN leaked in Sanitized After pane!"
      );
      await ctx.shot("01-401-race-dual-ast-diff");

      // Switch to Token Lineage tab & verify 3 hops for JWT_TOKEN_#1
      await page.getByTestId("tab-token-lineage").click();
      await ctx.expectVisible('[data-testid="token-lineage-view"]');
      await ctx.expectText(/REJECTED_401/i);
      await ctx.shot("02-token-lineage-graph");
    },
  },
  {
    id: "S3-competitor-torture-and-modes",
    title: "Cloudflare Issues #17/#22/#27/#44 Torture Trace, Redaction Modes & Reload Persistence",
    async run(page, ctx, vpName) {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });

      // Select Cloudflare Torture Suite preset
      await page.getByTestId("preset-selector").selectOption("cloudflare-torture-suite");
      await ctx.expectText(/18 Secrets Redacted/i);
      await ctx.expectText(/CF REGEX CORRUPTS JSON \(#22\)/i);

      // Switch redaction mode from ALIAS (#1) to STRICT
      await page.getByTestId("mode-strict-btn").click();

      if (vpName === "mobile") {
        await page.getByRole("button", { name: /2\. AST Diff/i }).click();
      }
      await page.getByTestId("tab-ast-diff").click();
      const strictAfterText = await page.getByTestId("sanitized-after-pane").textContent();
      ctx.assert(
        strictAfterText.includes("[REDACTED_"),
        "STRICT mode did not format replacements as [REDACTED_*]"
      );
      await ctx.shot("01-cloudflare-torture-strict-mode");

      // Reload page and verify state persistence (cloudflare-torture-suite + STRICT mode)
      await page.reload({ waitUntil: "domcontentloaded" });
      await ctx.expectText(/18 Secrets Redacted/i);
      await ctx.expectText(/CF REGEX CORRUPTS JSON \(#22\)/i);

      // Restore ALIAS (#1) mode
      await page.getByTestId("mode-pseudonym-btn").click();
    },
  },
  {
    id: "S4-repro-bundler-and-export",
    title: "Noise Stripping & Multi-Format Minimal Repro Bundler (cURL, Playwright, Markdown, .HAR)",
    async run(page, ctx, vpName) {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });

      await page.getByTestId("preset-selector").selectOption("stripe-webhook-checkout");
      await ctx.expectText(/5\/5 entries kept/i);

      // Toggle Strip Static/Telemetry Noise
      await page.getByTestId("strip-noise-checkbox").check();
      await ctx.expectText(/2\/5 entries kept/i);

      if (vpName === "mobile") {
        await page.getByRole("button", { name: /3\. Repro & Export/i }).click();
      } else {
        await page.getByTestId("tab-repro-export").click();
      }

      await ctx.expectVisible('[data-testid="repro-exporter-view"]');
      const curlOutput = await page.getByTestId("repro-code-output").textContent();
      ctx.assert(
        curlOutput.includes("https://api.velox.io/v1/checkout/confirm"),
        "cURL output missing core 500 failing endpoint"
      );
      ctx.assert(
        !curlOutput.includes("google-analytics.com"),
        "Noise entry was not stripped from cURL output"
      );
      ctx.assert(
        !curlOutput.includes("sk_test_velox_998877665544332211aabbcc"),
        "Raw API secret leaked into cURL output"
      );

      // Switch to Playwright API Spec format
      await page.getByTestId("repro-fmt-playwright").click();
      const pwOutput = await page.getByTestId("repro-code-output").textContent();
      ctx.assert(
        pwOutput.includes("expect(res_2.status()).toBe(500);"),
        "Playwright spec output missing status 500 assertion"
      );

      // Switch to Incident Report Markdown
      await page.getByTestId("repro-fmt-markdown").click();
      const mdOutput = await page.getByTestId("repro-code-output").textContent();
      ctx.assert(
        mdOutput.includes("# Diagnostic Incident Bundle"),
        "Markdown output missing header"
      );

      // Click Export Sanitized .HAR primary CTA
      await page.getByTestId("primary-export-har-btn").click();
      await ctx.expectVisible('[data-testid="export-success-banner"]');
      await ctx.expectText(/100% Valid JSON/i);
      await ctx.shot("01-repro-exported");
    },
  },
  {
    id: "S5-error-recovery-and-validation",
    title: "Invalid Custom Regex Validation & Truncated HAR Stream Auto-Repair",
    async run(page, ctx) {
      await page.goto(BASE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      // 1. Test empty rule submission error
      await page.getByTestId("apply-custom-rule-btn").click();
      await ctx.expectVisible('[data-testid="custom-rule-error"]');

      // 2. Test invalid regex syntax error
      await page.getByTestId("custom-regex-input").fill("[unclosed_regex_group");
      await page.getByTestId("apply-custom-rule-btn").click();
      await ctx.expectVisible('[data-testid="custom-rule-error"]');
      await ctx.expectText(/Invalid regular expression syntax/i);
      await ctx.shot("01-invalid-regex-error");

      // 3. Fix input and apply valid custom key rule (traceId)
      await page.getByTestId("custom-regex-input").fill("");
      await page.getByTestId("custom-key-input").fill("traceId");
      await page.getByTestId("apply-custom-rule-btn").click();
      await ctx.expectText(/22 Secrets Redacted/i);

      // 4. Test Truncated HAR Error State & 1-Click Auto-Repair
      await page.getByTestId("paste-har-btn").click();
      await ctx.expectVisible('[data-testid="paste-har-modal"]');
      await page.getByTestId("simulate-corrupted-har-btn").click();

      await ctx.expectVisible('[data-testid="parse-error-card"]');
      await ctx.expectText(/MALFORMED OR TRUNCATED HAR JSON SYNTAX/i);
      await ctx.shot("02-truncated-har-error-card");

      await page.getByTestId("auto-repair-har-btn").click();
      await ctx.expectVisible('[data-testid="export-success-banner"]');
      await ctx.expectText(/Auto-Repair succeeded/i);
      await ctx.shot("03-auto-repaired-workbench");
    },
  },
  {
    id: "S6-responsive-and-keyboard-a11y",
    title: "Responsive 390px Layout, Labeled Controls & Keyboard Navigation",
    async run(page, ctx, vpName) {
      await page.goto(BASE, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      ctx.assert(overflow <= 1, `horizontal overflow on ${vpName}: ${overflow}px`);

      // Verify zero unlabeled buttons across the entire DOM
      const unlabeledButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.filter((b) => {
          const text = (b.textContent || "").trim();
          const aria = b.getAttribute("aria-label") || b.getAttribute("title") || "";
          return text.length === 0 && aria.length === 0;
        }).length;
      });
      ctx.assert(unlabeledButtons === 0, `Found ${unlabeledButtons} unlabeled buttons`);

      // Keyboard navigation check: focus search input and filter by "401"
      const searchInput = page.getByTestId("waterfall-search-input");
      if (await searchInput.isVisible()) {
        await searchInput.focus();
        await page.keyboard.type("401");
        await ctx.expectText(/1 reqs/i);
      }
      await ctx.shot("01-responsive-a11y-verified");
    },
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectVisible(page, selector, timeout = 10000) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

async function expectText(page, text, timeout = 10000) {
  const locator = page.getByText(text).first();
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

function collectIssues(page) {
  const issues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push({ kind: "console", text: msg.text() });
  });
  page.on("pageerror", (err) => {
    issues.push({ kind: "pageerror", text: err.message });
  });
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "request failed";
    if (!reason.includes("ERR_ABORTED") && !reason.includes("NS_BINDING_ABORTED")) {
      issues.push({ kind: "requestfailed", text: `${reason} ${req.url()}` });
    }
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 500) issues.push({ kind: "http", text: `${status} ${res.url()}` });
    else if (status >= 400 && !res.url().includes("favicon.ico")) {
      issues.push({ kind: "http", level: "warn", text: `${status} ${res.url()}` });
    }
  });
  return issues;
}

async function main() {
  const browserType = BROWSER === "chromium" ? chromium : firefox;
  const browser = await browserType.launch({ headless: !HEADED });
  const startedAt = new Date().toISOString();
  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor,
    });

    for (const scenario of scenarios) {
      const page = await context.newPage();
      const issues = collectIssues(page);
      const screenshots = [];
      const started = Date.now();
      let status = "pass";
      let error = null;

      const ctx = {
        assert,
        expectVisible: (selector, timeout) => expectVisible(page, selector, timeout),
        expectText: (text, timeout) => expectText(page, text, timeout),
        shot: async (name, opts = {}) => {
          const file = path.join(SHOTS, `${scenario.id}-${name}-${vp.name}.png`);
          await page.screenshot({ path: file, fullPage: opts.fullPage ?? true });
          screenshots.push(file);
          return file;
        },
      };

      try {
        await scenario.run(page, ctx, vp.name);
      } catch (err) {
        status = "fail";
        error = err.message;
      } finally {
        await page.close().catch(() => {});
      }

      const errors = issues.filter((i) => (i.level ?? "error") === "error");
      const warnings = issues.filter((i) => i.level === "warn");
      if (status === "pass" && errors.length > 0) {
        status = "fail";
        error = errors.map((i) => `${i.kind}: ${i.text}`).join(" | ");
      }

      results.push({
        viewport: vp.name,
        id: scenario.id,
        title: scenario.title,
        status,
        ms: Date.now() - started,
        error,
        errors,
        warnings,
        screenshots,
      });

      console.log(
        `${status === "pass" ? "✓" : "✗"} [${vp.name}] ${scenario.id}` +
          (error ? ` — ${error}` : "")
      );
    }

    await context.close();
  }

  await browser.close();

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
  };
  const finishedAt = new Date().toISOString();
  const report = {
    base: BASE,
    browser: BROWSER,
    headed: HEADED,
    startedAt,
    finishedAt,
    summary,
    results,
  };

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(report, null, 2));

  const warnings = results.flatMap((r) =>
    r.warnings.map((w) => `- [${r.viewport}] ${r.id}: ${w.kind} — ${w.text}`)
  );
  const md = [
    `# QA run — ${finishedAt}`,
    "",
    `- Base URL: ${BASE}`,
    `- Browser: ${BROWSER} (${HEADED ? "headed" : "headless"})`,
    `- Scenarios: ${summary.total} — ${summary.pass} pass, ${summary.fail} fail`,
    "",
    "| Viewport | Scenario | Status | ms | Detail |",
    "|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.viewport} | ${r.id} | ${r.status} | ${r.ms} | ${(r.error ?? "").replace(/\|/g, "\\|")} |`
    ),
    "",
    ...(warnings.length ? ["## Warnings", "", ...warnings, ""] : []),
    "## Screenshots",
    "",
    ...results.flatMap((r) => r.screenshots.map((s) => `- ${s}`)),
    "",
  ];
  fs.writeFileSync(path.join(OUT, "report.md"), md.join("\n"));

  console.log(`\n${summary.pass}/${summary.total} passed — see ${OUT}/`);
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
