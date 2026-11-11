import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('evidence/stage-2-build/frontend');
fs.mkdirSync(outDir, { recursive: true });

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', '4487', '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'pipe',
  });

  try {
    const baseUrl = 'http://127.0.0.1:4487/';
    await waitForServer(baseUrl);

    const browser = await chromium.launch({ headless: true });

    // 1. Desktop 1440x900 Verification
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopCtx.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Screenshot 1: Default Active Workbench (OAuth 401 Race + Dual-AST Diff)
    await page.screenshot({ path: path.join(outDir, '01-desktop-1440-workbench.png'), fullPage: true });

    // Click JWT_TOKEN_#1 lineage pill to highlight 401 race across requests, then click Entry #6 (401 Unauthorized)
    await page.getByTestId('lineage-pill-JWT_TOKEN_#1').click();
    await page.getByTestId('waterfall-entry-5').click();
    await page.screenshot({ path: path.join(outDir, '02-desktop-1440-401-race-lineage.png'), fullPage: true });

    // Switch to Token Lineage Tab
    await page.getByTestId('tab-token-lineage').click();
    await page.screenshot({ path: path.join(outDir, '03-desktop-1440-token-lineage-tab.png'), fullPage: true });

    // Switch to Repro Bundle Exporter Tab (Playwright Spec)
    await page.getByTestId('tab-repro-export').click();
    await page.getByTestId('repro-fmt-playwright').click();
    await page.screenshot({ path: path.join(outDir, '04-desktop-1440-repro-exporter.png'), fullPage: true });

    // Test Invalid Regex Input State
    await page.getByTestId('custom-regex-input').fill('[unterminated_group');
    await page.getByTestId('apply-custom-rule-btn').click();
    await page.screenshot({ path: path.join(outDir, '05-desktop-1440-invalid-input-state.png'), fullPage: false });

    // Test Corrupted HAR Error + Auto-Repair State
    await page.getByTestId('paste-har-btn').click();
    await page.getByTestId('simulate-corrupted-har-btn').click();
    await page.waitForSelector('[data-testid="parse-error-card"]');
    await page.screenshot({ path: path.join(outDir, '06-desktop-1440-error-autorepair-state.png'), fullPage: false });

    // Click Auto-Repair button to verify recovery
    await page.getByTestId('auto-repair-har-btn').click();
    await page.waitForSelector('[data-testid="export-success-banner"]');

    // Test Empty State (Clear Airlock)
    await page.getByTestId('clear-airlock-btn').click();
    await page.waitForSelector('[data-testid="empty-intake-state"]');
    await page.screenshot({ path: path.join(outDir, '07-desktop-1440-empty-intake-state.png'), fullPage: true });

    // Restore Preset #2 (Cloudflare Torture Suite) from Empty State
    await page.getByTestId('empty-preset-cloudflare-torture-suite').click();
    await page.waitForSelector('[data-testid="competitor-audit-card"]');
    await page.screenshot({ path: path.join(outDir, '08-desktop-1440-cloudflare-torture-preset.png'), fullPage: true });

    await desktopCtx.close();

    // 2. Mobile 390x844 Verification
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mPage = await mobileCtx.newPage();
    await mPage.goto(baseUrl, { waitUntil: 'networkidle' });

    const scrollWidth = await mPage.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await mPage.evaluate(() => window.innerWidth);
    console.log(`Mobile 390px viewport check: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`);
    if (scrollWidth > innerWidth) {
      throw new Error(`Mobile horizontal overflow detected: ${scrollWidth} > ${innerWidth}`);
    }

    await mPage.screenshot({ path: path.join(outDir, '09-mobile-390-waterfall.png'), fullPage: false });

    // Switch mobile station to 2. AST Diff
    await mPage.getByText('2. AST Diff').click();
    await mPage.screenshot({ path: path.join(outDir, '10-mobile-390-ast-diff.png'), fullPage: false });

    await mobileCtx.close();
    await browser.close();
    console.log('Stage 2 frontend screenshots & UX verification completed successfully.');
  } finally {
    server.kill('SIGTERM');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
