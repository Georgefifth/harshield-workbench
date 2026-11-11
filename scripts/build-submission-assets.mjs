import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const assetsDir = path.resolve('submission/assets');
fs.mkdirSync(assetsDir, { recursive: true });

// 1. Copy final rendered demo video into submission/assets/demo.mp4
fs.copyFileSync(
  path.resolve('evidence/stage-4-demo/demo.mp4'),
  path.join(assetsDir, 'demo.mp4')
);

const THUMBNAIL_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 800px;
      background: radial-gradient(circle at 82% 18%, rgba(6,182,212,0.16), transparent 45%),
                  radial-gradient(circle at 18% 85%, rgba(16,185,129,0.14), transparent 45%),
                  #0A0D12;
      color: #F1F5F9;
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 52px 60px;
      border: 3px solid #232E3F;
      position: relative;
      overflow: hidden;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(to right, rgba(35,46,63,0.35) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(35,46,63,0.35) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }
    .top-bar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
      border-radius: 6px;
      background: rgba(6,182,212,0.14);
      border: 1.5px solid #06B6D4;
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      color: #06B6D4;
      letter-spacing: 0.08em;
    }
    .airlock-pill {
      padding: 10px 18px;
      border-radius: 6px;
      background: rgba(16,185,129,0.14);
      border: 1.5px solid #10B981;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 700;
      color: #10B981;
    }
    .hero-center {
      position: relative;
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 44px;
      align-items: center;
      margin: 16px 0;
    }
    h1 {
      font-size: 62px;
      line-height: 1.04;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #F1F5F9;
      margin-bottom: 18px;
    }
    h1 span {
      color: #06B6D4;
    }
    .subtitle {
      font-size: 22px;
      line-height: 1.45;
      color: #94A3B8;
      margin-bottom: 28px;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .kpi-card {
      background: #11161F;
      border: 1.5px solid #232E3F;
      border-top: 3px solid #10B981;
      border-radius: 8px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi-val {
      font-size: 28px;
      font-weight: 700;
      color: #10B981;
    }
    .kpi-lbl {
      font-size: 12px;
      color: #94A3B8;
      margin-top: 4px;
    }
    .pipeline-diagram {
      background: #11161F;
      border: 2px solid #232E3F;
      border-radius: 12px;
      padding: 24px;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.55);
    }
    .stage-box {
      padding: 16px 18px;
      border-radius: 8px;
      background: #0A0D12;
    }
    .stage-raw { border-left: 4px solid #EF4444; border: 1px solid rgba(239,68,68,0.4); border-left-width: 5px; }
    .stage-ast { border-left: 4px solid #06B6D4; border: 1px solid rgba(6,182,212,0.5); border-left-width: 5px; }
    .stage-safe { border-left: 4px solid #10B981; border: 1px solid rgba(16,185,129,0.5); border-left-width: 5px; }
    .stage-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    .stage-code {
      font-size: 13px;
      line-height: 1.5;
    }
    .footer-bar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 20px;
      border-top: 1.5px solid #232E3F;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="top-bar">
    <div class="brand-pill">🛡️ HARSHIELD WORKBENCH v1.0 · SILICON VALLEY BUILDATHON</div>
    <div class="airlock-pill">LOCAL V8 AIRLOCK · 0 B NETWORK EGRESS</div>
  </div>

  <div class="hero-center">
    <div>
      <h1>Structure-Preserving <span>HAR 1.2</span> AST Sanitizer</h1>
      <p class="subtitle">
        Recursively scrubs nested JSON bodies, OAuth tokens, and presigned URLs while preserving cross-request 401 token lineage.
      </p>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-val">100.0%</div>
          <div class="kpi-lbl">Secret Recall (30/30 vs 26.7% CF)</div>
        </div>
        <div class="kpi-card" style="border-top-color:#06B6D4;">
          <div class="kpi-val" style="color:#06B6D4;">JWT_#1</div>
          <div class="kpi-lbl">Referential 401 Race Lineage</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">0 Leaks</div>
          <div class="kpi-lbl">100% Valid JSON + Repro Spec</div>
        </div>
      </div>
    </div>

    <div class="pipeline-diagram">
      <div class="stage-box stage-raw">
        <div class="stage-title" style="color:#EF4444;">1. RAW .HAR CAPTURE (EXPOSED)</div>
        <div class="stage-code" style="color:#FCA5A5;">
          POST /oauth/token → "access_token": "eyJhbG..."<br/>
          GET /s3/dump?X-Amz-Signature=9f86d081...
        </div>
      </div>

      <div class="stage-box stage-ast">
        <div class="stage-title" style="color:#06B6D4;">2. RECURSIVE MIME &amp; JSON AST ENGINE</div>
        <div class="stage-code" style="color:#E2E8F0;">
          Unwraps JSON-in-JSON · Form · Base64 · Quoted HDR<br/>
          Fixes Cloudflare #17, #22, #27 &amp; #44
        </div>
      </div>

      <div class="stage-box stage-safe">
        <div class="stage-title" style="color:#10B981;">3. VERIFIED SAFE REPRO BUNDLE</div>
        <div class="stage-code" style="color:#6EE7B7;">
          "access_token": "JWT_TOKEN_#1" [Linked 3x]<br/>
          Exports: .sanitized.har · cURL · Playwright Spec
        </div>
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>BENCHMARKED ON 12 REAL-WORLD MITMPROXY &amp; POLLY.JS TRACES</span>
    <span style="color:#06B6D4;font-weight:700;">georgefifth.github.io/harshield-workbench</span>
  </div>
</body>
</html>`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(THUMBNAIL_HTML, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(assetsDir, 'thumbnail.png') });
  await browser.close();

  // Convert 6 key screenshots/slides into exact 1200x800 (3:2 ratio) gallery PNGs with dark obsidian letterbox padding
  const sources = [
    {
      src: 'evidence/stage-3-qa/screens/S1-first-visit-and-airlock-01-landing-workbench-desktop.png',
      dst: 'gallery-01-forensic-workbench.png',
    },
    {
      src: 'evidence/stage-3-qa/screens/S2-core-sanitization-and-lineage-01-401-race-dual-ast-diff-desktop.png',
      dst: 'gallery-02-401-race-dual-ast-diff.png',
    },
    {
      src: 'evidence/stage-3-qa/screens/S4-repro-bundler-and-export-01-repro-exported-desktop.png',
      dst: 'gallery-03-repro-bundler-export.png',
    },
    {
      src: 'evidence/stage-3.5-validation/screens/01-rw01-mitmproxy-uploaded.png',
      dst: 'gallery-04-realworld-mitmproxy-trace.png',
    },
    {
      src: 'evidence/stage-4-demo/frames/scene-03-exploded_architecture.png',
      dst: 'gallery-05-four-layer-ast-architecture.png',
    },
    {
      src: 'evidence/stage-4-demo/frames/scene-06-validation_benchmark.png',
      dst: 'gallery-06-stage35-validation-benchmark.png',
    },
  ];

  for (const item of sources) {
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      path.resolve(item.src),
      '-vf',
      'scale=1200:800:force_original_aspect_ratio=decrease,pad=1200:800:(ow-iw)/2:(oh-ih)/2:color=#0A0D12',
      path.join(assetsDir, item.dst),
    ]);
  }

  console.log('Generated thumbnail.png and 6 gallery-*.png assets at 1200x800 (3:2 ratio).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
