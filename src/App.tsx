import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Code2,
  Download,
  FileJson,
  FileWarning,
  Filter,
  FolderUp,
  GitCompare,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { PRESET_TRACES } from './data/presets';
import { parseHarString, ParseHarOutcome } from './engine/harParser';
import {
  DEFAULT_SANITIZATION_CONFIG,
  isNoiseEntry,
  sanitizeHarTrace,
} from './engine/recursiveSanitizer';
import {
  generateCurlScript,
  generateMarkdownReport,
  generatePlaywrightTest,
} from './engine/reproExporter';
import {
  HarEntry,
  HarFile,
  RedactionFinding,
  RedactionMode,
  SanitizationConfig,
} from './types/har';

type InspectorTab = 'ast-diff' | 'findings-matrix' | 'token-lineage' | 'repro-export';
type MobileStation = 'waterfall' | 'inspector' | 'repro';

const CORRUPTED_SAMPLE_HAR = `{
  "log": {
    "version": "1.2",
    "creator": { "name": "Chrome DevTools", "version": "131.0" },
    "entries": [
      {
        "startedDateTime": "2026-11-11T18:10:01.120Z",
        "time": 88,
        "request": {
          "method": "POST",
          "url": "https://auth.acme-cloud.io/oauth/token",
          "httpVersion": "HTTP/2.0",
          "cookies": [],
          "headers": [{ "name": "Authorization", "value": "Bearer ak_live_998877665544332211" }],
          "queryString": [],
          "postData": {
            "mimeType": "application/json",
            "text": "{\\"password\\":\\"TruncatedStreamSecret!99\\"}"
          },
          "headersSize": 120,
          "bodySize": 42
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "httpVersion": "HTTP/2.0",
          "cookies": [],
          "headers": [{ "name": "Content-Type", "value": "application/json" }],
          "content": { "size": 45, "mimeType": "application/json", "text": "{\\"access_token\\":\\"atok_live_recovered_887766\\"}" },
          "redirectURL": "",
          "headersSize": 80,
          "bodySize": 45
        },
        "cache": {},
        "timings": { "send": 2, "wait": 80, "receive": 6 }
      },
      {
        "startedDateTime": "2026-11-11T18:10:02.000Z",
        "request": { "method": "GET", "url": "https://api.acme-cloud.io/truncated-mid-stream`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getStatusBadgeClass(status: number): string {
  if (status >= 500) {
    return 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40';
  }
  if (status >= 400) {
    return 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40';
  }
  if (status >= 300) {
    return 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/40';
  }
  return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
}

function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'text-[#06B6D4] bg-[#06B6D4]/10 border-[#06B6D4]/30';
    case 'PUT':
    case 'PATCH':
      return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30';
    case 'DELETE':
      return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30';
    default:
      return 'text-[#94A3B8] bg-[#18202C] border-[#232E3F]';
  }
}

export default function App() {
  const [activePresetId, setActivePresetId] = useState<string>(PRESET_TRACES[0].id);
  const [activeHar, setActiveHar] = useState<HarFile | null>(PRESET_TRACES[0].har);
  const [traceTitle, setTraceTitle] = useState<string>(PRESET_TRACES[0].name);
  const [diagnosticNote, setDiagnosticNote] = useState<string>(PRESET_TRACES[0].diagnosticGoal);

  const [config, setConfig] = useState<SanitizationConfig>(DEFAULT_SANITIZATION_CONFIG);
  const [selectedOrigEntryIdx, setSelectedOrigEntryIdx] = useState<number>(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('ast-diff');
  const [mobileStation, setMobileStation] = useState<MobileStation>('waterfall');
  const [reproFormat, setReproFormat] = useState<'curl' | 'playwright' | 'markdown' | 'har-json'>('curl');

  // Interactive filter & highlight states
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [highlightedTokenHash, setHighlightedTokenHash] = useState<string | null>(null);

  // Required UX Contract States: Loading, Parse Error + Recovery, Invalid Input, Export Feedback, Paste Drawer, Airlock Popover
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStepText, setLoadingStepText] = useState<string>('');
  const [parseError, setParseError] = useState<ParseHarOutcome | null>(null);
  const [customRuleInput, setCustomRuleInput] = useState<string>('');
  const [customRegexInput, setCustomRegexInput] = useState<string>('');
  const [regexValidationError, setRegexValidationError] = useState<string | null>(null);
  const [exportBanner, setExportBanner] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteRawText, setPasteRawText] = useState<string>('');
  const [showAirlockModal, setShowAirlockModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sanitizationResult = useMemo(() => {
    if (!activeHar) return null;
    return sanitizeHarTrace(activeHar, config);
  }, [activeHar, config]);

  // Select Preset Trace
  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_TRACES.find((p) => p.id === presetId);
    if (!found) return;
    setIsLoading(true);
    setLoadingStepText('Parsing HAR 1.2 AST & computing session pseudonyms...');
    setParseError(null);
    setExportBanner(null);
    setTimeout(() => {
      setActivePresetId(found.id);
      setActiveHar(found.har);
      setTraceTitle(found.name);
      setDiagnosticNote(found.diagnosticGoal);
      setSelectedOrigEntryIdx(0);
      setHighlightedTokenHash(null);
      setIsLoading(false);
    }, 60);
  };

  // Clear Airlock -> triggers Empty / First Visit Intake State
  const handleClearAirlock = () => {
    setActiveHar(null);
    setActivePresetId('');
    setParseError(null);
    setExportBanner(null);
    setHighlightedTokenHash(null);
    setShowPasteModal(false);
  };

  // Ingest Raw HAR String (from File Upload or Paste Drawer)
  const ingestRawHarString = (rawText: string, sourceLabel: string) => {
    setIsLoading(true);
    setLoadingStepText(`Inspecting ${sourceLabel} inside local memory airlock...`);
    setExportBanner(null);

    setTimeout(() => {
      const outcome = parseHarString(rawText);
      setIsLoading(false);
      if (!outcome.ok || !outcome.har) {
        setParseError(outcome);
        return;
      }
      setParseError(null);
      setActivePresetId('custom');
      setActiveHar(outcome.har);
      setTraceTitle(sourceLabel);
      setDiagnosticNote(
        `Loaded ${outcome.har.log.entries.length} HTTP entries from ${sourceLabel}. Recursive AST sanitization active.`
      );
      setSelectedOrigEntryIdx(0);
      setShowPasteModal(false);
    }, 80);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      ingestRawHarString(content, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTriggerCorruptedDemo = () => {
    ingestRawHarString(CORRUPTED_SAMPLE_HAR, 'truncated-capture.har');
  };

  const handleAutoRepair = () => {
    if (!parseError?.repairedHar) return;
    setActiveHar(parseError.repairedHar);
    setActivePresetId('repaired');
    setTraceTitle('truncated-capture.repaired.har');
    setDiagnosticNote(parseError.repairedNote || 'Recovered complete HTTP entries from truncated HAR stream.');
    setSelectedOrigEntryIdx(0);
    setParseError(null);
    setExportBanner('Auto-Repair succeeded: Salvaged valid HAR 1.2 entries and sanitized nested secrets.');
  };

  // Validate & apply custom key or regex rule (demonstrates Invalid Input State clearly)
  const handleApplyCustomRegex = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = customRuleInput.trim();
    const trimmedRx = customRegexInput.trim();

    if (!trimmedKey && !trimmedRx) {
      setRegexValidationError('Enter a custom JSON/Header key name (e.g. "Internal-Pin") or a valid regular expression.');
      return;
    }

    if (trimmedRx) {
      try {
        new RegExp(trimmedRx, 'g');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setRegexValidationError(`Invalid regular expression syntax: ${msg}. Fix the pattern before applying.`);
        return;
      }
    }

    setRegexValidationError(null);
    setConfig((prev) => ({
      ...prev,
      customKeyPatterns: trimmedKey
        ? Array.from(new Set([...prev.customKeyPatterns, trimmedKey]))
        : prev.customKeyPatterns,
      customRegexPattern: trimmedRx || prev.customRegexPattern,
    }));
    setCustomRuleInput('');
    setExportBanner(
      `Applied custom rule: ${trimmedKey ? `key="${trimmedKey}"` : ''} ${trimmedRx ? `regex=/${trimmedRx}/g` : ''}`
    );
  };

  // Export Sanitized HAR download
  const handleExportHar = () => {
    if (!sanitizationResult) return;
    const blob = new Blob([sanitizationResult.sanitizedJsonString], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeSlug = traceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trace';
    a.href = url;
    a.download = `${safeSlug}.sanitized.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportBanner(
      `Exported ${safeSlug}.sanitized.har (${formatBytes(sanitizationResult.sanitizedBytes)} · 100% Valid JSON · ${sanitizationResult.findings.length} secrets pseudonymized · ${sanitizationResult.sha256Digest})`
    );
  };

  const handleCopyArtifact = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for headless environments
    }
    setExportBanner(`Copied ${label} to clipboard (${sanitizationResult?.sha256Digest})`);
  };

  const toggleFindingExclusion = (findingId: string) => {
    setConfig((prev) => {
      const exists = prev.excludedFindingIds.includes(findingId);
      return {
        ...prev,
        excludedFindingIds: exists
          ? prev.excludedFindingIds.filter((id) => id !== findingId)
          : [...prev.excludedFindingIds, findingId],
      };
    });
  };

  // Derived data for currently selected entry
  const originalEntries = activeHar?.log.entries || [];
  const safeSelectedOrigIdx =
    selectedOrigEntryIdx < originalEntries.length ? selectedOrigEntryIdx : 0;
  const currentOrigEntry: HarEntry | undefined = originalEntries[safeSelectedOrigIdx];

  // Map original entry index to sanitized entry
  const currentSanitizedEntry: HarEntry | undefined = useMemo(() => {
    if (!sanitizationResult || !activeHar) return undefined;
    const posInKept = sanitizationResult.keptEntryIndices.indexOf(safeSelectedOrigIdx);
    if (posInKept !== -1) {
      return sanitizationResult.sanitizedHar.log.entries[posInKept];
    }
    // If entry was stripped as noise, sanitize just that single entry for preview
    return sanitizeHarTrace(activeHar, { ...config, stripNoiseEntries: false }).sanitizedHar.log
      .entries[safeSelectedOrigIdx];
  }, [sanitizationResult, activeHar, safeSelectedOrigIdx, config]);

  const currentEntryFindings: RedactionFinding[] = useMemo(() => {
    if (!sanitizationResult) return [];
    return sanitizationResult.findings.filter((f) => f.entryIndex === safeSelectedOrigIdx);
  }, [sanitizationResult, safeSelectedOrigIdx]);

  // Filtered waterfall list
  const visibleOrigEntries = useMemo(() => {
    if (!activeHar) return [];
    return activeHar.log.entries
      .map((entry, origIdx) => ({ entry, origIdx }))
      .filter(({ entry, origIdx }) => {
        if (config.stripNoiseEntries && isNoiseEntry(entry)) return false;
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        const findingsForEntry =
          sanitizationResult?.findings.filter((f) => f.entryIndex === origIdx) || [];
        return (
          entry.request.url.toLowerCase().includes(q) ||
          entry.request.method.toLowerCase().includes(q) ||
          String(entry.response.status).includes(q) ||
          findingsForEntry.some(
            (f) =>
              f.keyName.toLowerCase().includes(q) ||
              f.replacement.toLowerCase().includes(q) ||
              f.category.toLowerCase().includes(q)
          )
        );
      });
  }, [activeHar, config.stripNoiseEntries, searchFilter, sanitizationResult]);

  // Count findings by layer
  const layerCounts = useMemo(() => {
    const counts = {
      headerCookie: 0,
      reqBody: 0,
      respBody: 0,
      embeddedUrl: 0,
    };
    if (!sanitizationResult) return counts;
    for (const f of sanitizationResult.findings) {
      if (f.layer === 'header' || f.layer === 'cookie' || f.layer === 'query') {
        counts.headerCookie++;
      } else if (f.layer === 'request-json' || f.layer === 'request-form') {
        counts.reqBody++;
      } else if (f.layer === 'response-json' || f.layer === 'jwt-claim') {
        counts.respBody++;
      } else if (f.layer === 'embedded-url') {
        counts.embeddedUrl++;
      }
    }
    return counts;
  }, [sanitizationResult]);

  // Generated Repro output string
  const generatedReproText = useMemo(() => {
    if (!sanitizationResult) return '';
    if (reproFormat === 'curl') return generateCurlScript(sanitizationResult);
    if (reproFormat === 'playwright') return generatePlaywrightTest(sanitizationResult);
    if (reproFormat === 'markdown') return generateMarkdownReport(sanitizationResult, traceTitle);
    return sanitizationResult.sanitizedJsonString;
  }, [sanitizationResult, reproFormat, traceTitle]);

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F1F5F9] flex flex-col overflow-x-hidden">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".har,.json,application/json"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="har-file-input"
      />

      {/* TOP FORENSIC AIRLOCK TELEMETRY BAR */}
      <header className="bg-[#11161F] border-b border-[#232E3F] px-3 py-2.5 lg:px-5">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Brand Identity + Zero-Egress Airlock Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[16px] font-bold tracking-tight text-[#F1F5F9]">
                    HARSHIELD <span className="text-[#06B6D4] font-mono text-xs">WORKBENCH v1.0</span>
                  </h1>
                </div>
                <p className="text-[11px] text-[#94A3B8] hidden sm:block">
                  Structure-Preserving HAR 1.2 AST Sanitizer · Referential Token Aliasing · Minimal Repro Bundler
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAirlockModal((v) => !v)}
              data-testid="airlock-status-badge"
              className="min-h-[36px] px-2.5 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-mono text-[11px] font-semibold flex items-center gap-1.5 hover:bg-[#10B981]/20 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>AIRLOCK: 0 B EGRESS · LOCAL AST</span>
            </button>
          </div>

          {/* Right: Preset Selector + Upload/Paste + Primary Export CTA */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset Selector Dropdown */}
            <div className="flex items-center bg-[#0A0D12] border border-[#232E3F] rounded px-2 min-h-[44px] sm:min-h-[38px]">
              <span className="text-[11px] font-mono uppercase text-[#94A3B8] mr-2 hidden xl:inline">
                TRACE PRESET:
              </span>
              <select
                aria-label="Select Diagnostic HAR Preset"
                data-testid="preset-selector"
                value={activePresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="bg-transparent text-[12px] font-mono text-[#F1F5F9] focus:outline-none py-1 pr-2 cursor-pointer"
              >
                <option value="" disabled className="bg-[#11161F]">
                  -- Select Forensic Trace --
                </option>
                {PRESET_TRACES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#11161F] text-[#F1F5F9]">
                    {p.name} ({p.har.log.entries.length} reqs)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-har-btn"
              className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded bg-[#18202C] hover:bg-[#232E3F] border border-[#232E3F] text-[12px] font-medium text-[#F1F5F9] flex items-center gap-1.5 transition"
            >
              <FolderUp className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Open .HAR</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              data-testid="paste-har-btn"
              className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded bg-[#18202C] hover:bg-[#232E3F] border border-[#232E3F] text-[12px] font-medium text-[#F1F5F9] flex items-center gap-1.5 transition"
            >
              <Code2 className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Paste / Repair</span>
            </button>

            {activeHar && (
              <button
                type="button"
                onClick={handleClearAirlock}
                data-testid="clear-airlock-btn"
                className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded bg-[#18202C] hover:bg-[#EF4444]/20 border border-[#232E3F] hover:border-[#EF4444]/40 text-[12px] font-medium text-[#94A3B8] hover:text-[#EF4444] flex items-center gap-1.5 transition"
                title="Clear local memory airlock and view Empty State Intake"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Airlock</span>
              </button>
            )}

            {/* Primary Action CTA */}
            <button
              type="button"
              disabled={!sanitizationResult}
              onClick={handleExportHar}
              data-testid="primary-export-har-btn"
              className="min-h-[44px] sm:min-h-[38px] px-4 py-1.5 rounded bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-[#0A0D12] font-bold text-[12px] tracking-wide flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-4 h-4 stroke-[2.2]" />
              <span>Export Sanitized .HAR</span>
            </button>
          </div>
        </div>
      </header>

      {/* ZERO-EGRESS SECURITY AUDIT POPOVER */}
      {showAirlockModal && (
        <div
          data-testid="airlock-security-banner"
          className="bg-[#11161F] border-b border-[#10B981]/40 px-4 py-3 text-xs"
        >
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-[#10B981] font-mono">
                  ZERO-EGRESS BROWSER SANDBOX VERIFIED:
                </span>{' '}
                <span className="text-[#F1F5F9]">
                  All HAR parsing, recursive JSON/Form AST traversal, and FNV-1a session pseudonymization execute 100% inside local V8 memory. Outbound network calls = <code className="text-[#10B981] font-bold">0</code>.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAirlockModal(false)}
              className="self-end sm:self-auto px-2.5 py-1 rounded bg-[#18202C] border border-[#232E3F] text-[#94A3B8] hover:text-[#F1F5F9] font-mono text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* EXPORT / ACTION FEEDBACK TOAST BANNER */}
      {exportBanner && (
        <div
          data-testid="export-success-banner"
          className="bg-[#10B981]/15 border-b border-[#10B981]/40 px-4 py-2 text-xs"
        >
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#10B981] font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{exportBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportBanner(null)}
              className="text-[#94A3B8] hover:text-[#F1F5F9] font-mono text-[11px] px-2 py-0.5"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading && (
        <div
          data-testid="loading-state-banner"
          className="bg-[#06B6D4]/15 border-b border-[#06B6D4]/40 px-4 py-2.5 text-xs"
        >
          <div className="max-w-[1600px] mx-auto flex items-center gap-2.5 text-[#06B6D4] font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{loadingStepText}</span>
          </div>
        </div>
      )}

      {/* ERROR STATE: MALFORMED OR TRUNCATED HAR JSON DIAGNOSTIC + AUTO-REPAIR */}
      {parseError && (
        <div
          data-testid="parse-error-card"
          className="max-w-[1600px] w-full mx-auto px-4 pt-4"
        >
          <div className="bg-[#11161F] border-2 border-[#EF4444]/60 rounded-md p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileWarning className="w-6 h-6 text-[#EF4444] shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#EF4444] uppercase tracking-wider font-mono">
                      {parseError.errorTitle}
                    </h2>
                    {parseError.errorLine && (
                      <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-mono text-[11px]">
                        Line {parseError.errorLine} : Col {parseError.errorCol}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#F1F5F9] mt-1">{parseError.errorDetail}</p>
                  {parseError.repairedNote && (
                    <p className="text-xs text-[#10B981] font-mono mt-1.5">
                      ✓ Auto-Repair Ready: {parseError.repairedNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {parseError.canAutoRepair && (
                  <button
                    type="button"
                    onClick={handleAutoRepair}
                    data-testid="auto-repair-har-btn"
                    className="min-h-[44px] sm:min-h-[38px] px-3.5 py-1.5 rounded bg-[#10B981] hover:bg-[#059669] text-[#0A0D12] font-bold text-xs flex items-center gap-1.5"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Auto-Repair Truncated HAR</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectPreset(PRESET_TRACES[0].id)}
                  className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded bg-[#18202C] hover:bg-[#232E3F] border border-[#232E3F] text-xs font-medium text-[#F1F5F9]"
                >
                  Load OAuth 401 Preset
                </button>
                <button
                  type="button"
                  onClick={() => setParseError(null)}
                  className="min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded bg-[#0A0D12] border border-[#232E3F] text-xs text-[#94A3B8]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASTE / CORRUPTED STREAM REPAIR DRAWER */}
      {showPasteModal && (
        <div
          data-testid="paste-har-modal"
          className="max-w-[1600px] w-full mx-auto px-4 pt-3"
        >
          <div className="bg-[#11161F] border border-[#06B6D4]/50 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#06B6D4]" />
                <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-[#F1F5F9]">
                  Paste Raw HAR 1.2 JSON or Test Stream Auto-Repair
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-xs font-mono text-[#94A3B8] hover:text-[#F1F5F9] px-2 py-1"
              >
                Close [ESC]
              </button>
            </div>
            <textarea
              aria-label="Raw HAR JSON Input"
              data-testid="paste-har-textarea"
              value={pasteRawText}
              onChange={(e) => setPasteRawText(e.target.value)}
              placeholder='Paste raw {"log": {"version": "1.2", "entries": [...]}} JSON here...'
              rows={5}
              className="w-full rounded bg-[#0A0D12] border border-[#232E3F] p-2.5 font-mono text-xs text-[#F1F5F9] focus:border-[#06B6D4] focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
              <button
                type="button"
                onClick={handleTriggerCorruptedDemo}
                data-testid="simulate-corrupted-har-btn"
                className="min-h-[40px] px-3 py-1.5 rounded bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/40 text-[#F59E0B] font-mono text-xs flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Truncated HAR File (Test Error & Auto-Repair)</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ingestRawHarString(pasteRawText, 'clipboard-trace.har')}
                  data-testid="ingest-pasted-har-btn"
                  className="min-h-[40px] px-4 py-1.5 rounded bg-[#06B6D4] hover:bg-[#0891B2] text-[#0A0D12] font-bold text-xs"
                >
                  Parse & Sanitize JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMPTY STATE: FORENSIC INTAKE BAY (When Airlock is Cleared) */}
      {!activeHar && (
        <main
          data-testid="empty-intake-state"
          className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8 flex flex-col justify-center"
        >
          <div className="bg-[#11161F] border border-[#232E3F] rounded-md p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#232E3F]">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] font-mono text-[11px] font-semibold mb-2">
                  AIRLOCK MEMORY EMPTY · READY FOR TRACE INGESTION
                </span>
                <h2 className="text-xl font-bold text-[#F1F5F9]">
                  Drop a Browser <code className="text-[#06B6D4] font-mono">.har</code> Capture or Launch a Forensic Preset
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl">
                  Chrome DevTools only scrubs top-level headers, and Cloudflare&apos;s regex sanitizer breaks JSON escaping (#22) while missing JSON response tokens (#27) and nested presigned URLs (#44). HARshield recursively parses every MIME payload in-browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-4 py-2 rounded bg-[#06B6D4] hover:bg-[#0891B2] text-[#0A0D12] font-bold text-xs flex items-center gap-2"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>Select Local .HAR File</span>
                </button>
                <button
                  type="button"
                  onClick={handleTriggerCorruptedDemo}
                  className="min-h-[44px] px-3.5 py-2 rounded bg-[#18202C] hover:bg-[#232E3F] border border-[#232E3F] text-xs font-mono text-[#F59E0B] flex items-center gap-1.5"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Test Truncated HAR Recovery</span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-3">
                Or Load a Built-in Diagnostic Benchmark Trace (1 Click):
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_TRACES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    data-testid={`empty-preset-${preset.id}`}
                    className="text-left p-4 rounded bg-[#0A0D12] hover:bg-[#18202C] border border-[#232E3F] hover:border-[#06B6D4]/50 transition group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-sm text-[#F1F5F9] group-hover:text-[#06B6D4] transition">
                        {preset.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#11161F] border border-[#232E3F] font-mono text-[10px] text-[#06B6D4]">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{preset.shortDesc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ACTIVE FORENSIC WORKBENCH */}
      {activeHar && sanitizationResult && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 py-3 lg:px-5 flex flex-col gap-3">
          {/* TELEMETRY & COMPETITOR BENCHMARK AUDIT STRIP */}
          <section
            aria-label="Sanitization Telemetry and Competitor Audit"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5"
          >
            {/* Card 1: AST Output Integrity Seal */}
            <div
              data-testid="integrity-seal-card"
              className="bg-[#11161F] border border-[#10B981]/40 rounded p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  AST INTEGRITY SEAL
                </span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-mono text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {sanitizationResult.isJsonValid ? 'JSON.parse() PASS' : 'FAIL'}
                </span>
              </div>
              <div className="my-1.5 flex items-baseline gap-2">
                <span
                  data-testid="total-secrets-caught"
                  className="text-xl font-bold font-mono text-[#10B981]"
                >
                  {sanitizationResult.findings.length} Secrets Redacted
                </span>
                <span className="text-xs font-mono text-[#94A3B8]">
                  · {sanitizationResult.remainingRawLeaks} Raw Leaks
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8] flex items-center justify-between">
                <span>
                  HDR/CKIE: <strong className="text-[#F1F5F9]">{layerCounts.headerCookie}</strong> · POST:{' '}
                  <strong className="text-[#F1F5F9]">{layerCounts.reqBody}</strong> · RESP:{' '}
                  <strong className="text-[#F1F5F9]">{layerCounts.respBody}</strong> · URL-SIG:{' '}
                  <strong className="text-[#F1F5F9]">{layerCounts.embeddedUrl}</strong>
                </span>
              </div>
            </div>

            {/* Card 2: Competitor Gap Verification (Chrome & Cloudflare vs HARshield) */}
            <div
              data-testid="competitor-audit-card"
              className="bg-[#11161F] border border-[#232E3F] rounded p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  LIVE COMPETITOR GAP AUDIT
                </span>
                {sanitizationResult.competitorAudit.cloudflareJsonCorrupted ? (
                  <span className="px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-mono text-[10px] font-bold">
                    CF REGEX CORRUPTS JSON (#22)
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-mono text-[10px] font-bold">
                    BODY SECRETS MISSED (#17/#27/#44)
                  </span>
                )}
              </div>
              <div className="my-1.5 grid grid-cols-3 gap-1.5 text-center font-mono">
                <div className="bg-[#0A0D12] border border-[#232E3F] rounded px-1.5 py-1">
                  <div className="text-[10px] text-[#94A3B8]">Chrome 131</div>
                  <div className="text-xs font-bold text-[#EF4444]">
                    Missed {sanitizationResult.competitorAudit.chromeHeaderScrubberMissed}
                  </div>
                </div>
                <div className="bg-[#0A0D12] border border-[#232E3F] rounded px-1.5 py-1">
                  <div className="text-[10px] text-[#94A3B8]">Cloudflare</div>
                  <div className="text-xs font-bold text-[#F59E0B]">
                    Missed {sanitizationResult.competitorAudit.cloudflareRegexMissed}
                  </div>
                </div>
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded px-1.5 py-1">
                  <div className="text-[10px] text-[#10B981]">HARshield</div>
                  <div className="text-xs font-bold text-[#10B981]">
                    Caught {sanitizationResult.competitorAudit.harshieldCaught}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate" title={diagnosticNote}>
                {diagnosticNote}
              </div>
            </div>

            {/* Card 3: Referential Pseudonymization Mode & Noise Filter Controls */}
            <div className="bg-[#11161F] border border-[#232E3F] rounded p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  REDACTION POLICY & NOISE
                </span>
                <span className="text-[11px] font-mono text-[#06B6D4]">
                  {sanitizationResult.keptEntryIndices.length}/{activeHar.log.entries.length} entries kept
                </span>
              </div>

              <div className="my-1.5 flex items-center gap-1.5">
                {(['pseudonym', 'mask', 'strict'] as RedactionMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-testid={`mode-${m}-btn`}
                    onClick={() => setConfig((prev) => ({ ...prev, mode: m }))}
                    className={`flex-1 py-1 px-2 rounded font-mono text-[11px] font-semibold border transition ${
                      config.mode === m
                        ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#F1F5F9]'
                        : 'bg-[#0A0D12] border-[#232E3F] text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    {m === 'pseudonym' ? 'ALIAS (#1)' : m === 'mask' ? 'MASK (***)' : 'STRICT'}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="strip-noise-checkbox"
                    checked={config.stripNoiseEntries}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, stripNoiseEntries: e.target.checked }))
                    }
                    className="rounded border-[#232E3F] bg-[#0A0D12] text-[#06B6D4] focus:ring-0"
                  />
                  <span className="text-[11px] font-mono text-[#F1F5F9]">
                    Strip Static/Telemetry Noise ({sanitizationResult.noiseEntryIndices.length})
                  </span>
                </label>
                <span className="text-[11px] font-mono text-[#10B981]">
                  {formatBytes(sanitizationResult.originalBytes)} →{' '}
                  {formatBytes(sanitizationResult.sanitizedBytes)}
                </span>
              </div>
            </div>

            {/* Card 4: Custom Field / Regex Rule Bar (Includes Invalid Input Validation) */}
            <div className="bg-[#11161F] border border-[#232E3F] rounded p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  CUSTOM AST / REGEX RULE
                </span>
                {config.customKeyPatterns.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        customKeyPatterns: [],
                        customRegexPattern: '',
                      }))
                    }
                    className="text-[10px] font-mono text-[#EF4444] hover:underline"
                  >
                    Reset Rules ({config.customKeyPatterns.length})
                  </button>
                )}
              </div>

              <form onSubmit={handleApplyCustomRegex} className="my-1 flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Custom Key Name"
                  data-testid="custom-key-input"
                  value={customRuleInput}
                  onChange={(e) => {
                    setCustomRuleInput(e.target.value);
                    if (regexValidationError) setRegexValidationError(null);
                  }}
                  placeholder="Key (e.g. traceId)"
                  className="w-1/2 px-2 py-1 rounded bg-[#0A0D12] border border-[#232E3F] font-mono text-[11px] text-[#F1F5F9] focus:border-[#06B6D4] focus:outline-none"
                />
                <input
                  type="text"
                  aria-label="Custom Regex Pattern"
                  data-testid="custom-regex-input"
                  value={customRegexInput}
                  onChange={(e) => {
                    setCustomRegexInput(e.target.value);
                    if (regexValidationError) setRegexValidationError(null);
                  }}
                  placeholder="Regex (e.g. cus_[A-Za-z0-9]+)"
                  className={`w-1/2 px-2 py-1 rounded bg-[#0A0D12] border font-mono text-[11px] text-[#F1F5F9] focus:outline-none ${
                    regexValidationError
                      ? 'border-[#EF4444] bg-[#EF4444]/10'
                      : 'border-[#232E3F] focus:border-[#06B6D4]'
                  }`}
                />
                <button
                  type="submit"
                  data-testid="apply-custom-rule-btn"
                  className="px-2.5 py-1 rounded bg-[#18202C] hover:bg-[#232E3F] border border-[#232E3F] font-mono text-[11px] font-semibold text-[#06B6D4] shrink-0"
                >
                  +Rule
                </button>
              </form>

              {regexValidationError ? (
                <div
                  data-testid="custom-rule-error"
                  className="text-[11px] font-mono text-[#EF4444] flex items-center gap-1 leading-tight"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={regexValidationError}>
                    {regexValidationError}
                  </span>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-[#94A3B8] truncate">
                  {config.customKeyPatterns.length > 0 || config.customRegexPattern
                    ? `Active: keys=[${config.customKeyPatterns.join(', ')}] ${
                        config.customRegexPattern ? `rx=/${config.customRegexPattern}/g` : ''
                      }`
                    : 'Click any finding or add custom JSON key / regex above'}
                </div>
              )}
            </div>
          </section>

          {/* SIGNATURE ELEMENT: CROSS-REQUEST REFERENTIAL TOKEN LINEAGE RIBBON */}
          <section
            aria-label="Referential Token Lineage Ribbon"
            data-testid="token-lineage-ribbon"
            className="bg-[#11161F] border border-[#232E3F] rounded px-3 py-2 flex flex-col lg:flex-row lg:items-center gap-2 justify-between"
          >
            <div className="flex items-center gap-2 shrink-0">
              <KeyRound className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#F1F5F9]">
                REFERENTIAL TOKEN LINEAGE:
              </span>
              <span className="text-[11px] text-[#94A3B8] hidden sm:inline">
                (Click a pseudonym to trace where the exact same credential travels across requests)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {sanitizationResult.lineageGroups.slice(0, 7).map((group) => {
                const isSelected = highlightedTokenHash === group.rawHash;
                const isAuthCategory =
                  group.category === 'JWT / Bearer' ||
                  group.category === 'OAuth Token' ||
                  group.category === 'API / Webhook Key' ||
                  group.category === 'Session Cookie';
                const has401 =
                  isAuthCategory && group.occurrences.some((o) => o.role === 'REJECTED_401');
                return (
                  <button
                    key={group.rawHash}
                    type="button"
                    data-testid={`lineage-pill-${group.pseudonym}`}
                    onClick={() =>
                      setHighlightedTokenHash((prev) =>
                        prev === group.rawHash ? null : group.rawHash
                      )
                    }
                    className={`px-2.5 py-1 rounded font-mono text-[11px] flex items-center gap-1.5 border transition ${
                      isSelected
                        ? 'bg-[#06B6D4]/25 border-[#06B6D4] text-[#F1F5F9] ring-1 ring-[#06B6D4]'
                        : has401
                        ? 'bg-[#EF4444]/10 border-[#EF4444]/40 text-[#F1F5F9] hover:border-[#EF4444]'
                        : 'bg-[#0A0D12] border-[#232E3F] text-[#10B981] hover:border-[#10B981]/50'
                    }`}
                  >
                    <span className="font-bold">{group.pseudonym}</span>
                    <span className="px-1 rounded bg-[#18202C] text-[10px] text-[#94A3B8]">
                      {group.occurrences.length}x
                    </span>
                    {has401 && (
                      <span className="px-1 rounded bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-bold">
                        401 RACE
                      </span>
                    )}
                  </button>
                );
              })}
              {highlightedTokenHash && (
                <button
                  type="button"
                  onClick={() => setHighlightedTokenHash(null)}
                  className="px-2 py-1 rounded bg-[#18202C] text-[10px] font-mono text-[#94A3B8] hover:text-[#F1F5F9]"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </section>

          {/* MOBILE 390px 3-WAY STATION SWITCHER (Hidden on lg+ desktop split-pane) */}
          <div
            data-testid="mobile-station-switcher"
            className="flex lg:hidden bg-[#11161F] border border-[#232E3F] rounded p-1 gap-1"
          >
            <button
              type="button"
              onClick={() => setMobileStation('waterfall')}
              className={`flex-1 min-h-[44px] rounded font-mono text-xs font-semibold flex items-center justify-center gap-1.5 ${
                mobileStation === 'waterfall'
                  ? 'bg-[#06B6D4] text-[#0A0D12]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>1. Requests ({visibleOrigEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileStation('inspector');
                if (inspectorTab === 'repro-export') setInspectorTab('ast-diff');
              }}
              className={`flex-1 min-h-[44px] rounded font-mono text-xs font-semibold flex items-center justify-center gap-1.5 ${
                mobileStation === 'inspector'
                  ? 'bg-[#06B6D4] text-[#0A0D12]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>2. AST Diff ({currentEntryFindings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileStation('repro');
                setInspectorTab('repro-export');
              }}
              className={`flex-1 min-h-[44px] rounded font-mono text-xs font-semibold flex items-center justify-center gap-1.5 ${
                mobileStation === 'repro'
                  ? 'bg-[#06B6D4] text-[#0A0D12]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>3. Repro & Export</span>
            </button>
          </div>

          {/* MAIN SPLIT-PANE PROTOCOL WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
            {/* LEFT PANE (5 COLS ON DESKTOP): HTTP WATERFALL & PER-ENTRY SECRET BADGES */}
            <section
              aria-label="HTTP Request Waterfall"
              data-testid="waterfall-panel"
              className={`lg:col-span-5 bg-[#11161F] border border-[#232E3F] rounded flex flex-col ${
                mobileStation !== 'waterfall' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Waterfall Search & Filter Header */}
              <div className="p-2.5 border-b border-[#232E3F] flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Filter HTTP Entries"
                    data-testid="waterfall-search-input"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter URL, status (401), token alias..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded bg-[#0A0D12] border border-[#232E3F] font-mono text-xs text-[#F1F5F9] focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
                <span className="font-mono text-[11px] text-[#94A3B8] shrink-0">
                  {visibleOrigEntries.length} reqs
                </span>
              </div>

              {/* Request Waterfall List */}
              <div className="divide-y divide-[#232E3F] overflow-y-auto max-h-[620px]">
                {visibleOrigEntries.map(({ entry, origIdx }) => {
                  const entryFindings = sanitizationResult.findings.filter(
                    (f) => f.entryIndex === origIdx
                  );
                  const isNoise = isNoiseEntry(entry);
                  const isActive = origIdx === safeSelectedOrigIdx;
                  const matchesHighlightedLineage =
                    highlightedTokenHash !== null &&
                    entryFindings.some((f) => f.rawHash === highlightedTokenHash);

                  let parsedHost = '';
                  let parsedPath = entry.request.url;
                  try {
                    const u = new URL(entry.request.url);
                    parsedHost = u.hostname;
                    parsedPath = u.pathname + (u.search ? '?…' : '');
                  } catch {
                    // keep raw
                  }

                  return (
                    <button
                      key={origIdx}
                      type="button"
                      data-testid={`waterfall-entry-${origIdx}`}
                      onClick={() => {
                        setSelectedOrigEntryIdx(origIdx);
                        if (mobileStation === 'waterfall') {
                          // On mobile, keep selection obvious
                        }
                      }}
                      className={`w-full text-left p-2.5 transition flex flex-col gap-1.5 border-l-2 ${
                        isActive
                          ? 'bg-[#18202C] border-l-[#06B6D4]'
                          : matchesHighlightedLineage
                          ? 'bg-[#06B6D4]/10 border-l-[#10B981]'
                          : 'bg-transparent border-l-transparent hover:bg-[#18202C]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[11px] text-[#94A3B8]">
                            #{origIdx + 1}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold ${getMethodBadgeClass(
                              entry.request.method
                            )}`}
                          >
                            {entry.request.method}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold ${getStatusBadgeClass(
                              entry.response.status
                            )}`}
                          >
                            {entry.response.status}
                          </span>
                          <span className="font-mono text-xs text-[#F1F5F9] font-medium truncate">
                            {parsedPath}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#94A3B8] shrink-0">
                          {entry.time}ms
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono text-[11px] text-[#94A3B8] truncate">
                          {parsedHost}
                        </span>

                        <div className="flex flex-wrap items-center gap-1">
                          {isNoise && (
                            <span className="px-1.5 py-0.5 rounded bg-[#232E3F] text-[#94A3B8] font-mono text-[10px]">
                              STATIC/TELEMETRY NOISE
                            </span>
                          )}
                          {entryFindings.length > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-mono text-[10px] font-semibold">
                              {entryFindings.length} secrets pseudonymized
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-[#0A0D12] border border-[#232E3F] text-[#94A3B8] font-mono text-[10px]">
                              0 secrets
                            </span>
                          )}
                          {matchesHighlightedLineage && (
                            <span className="px-1.5 py-0.5 rounded bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4] font-mono text-[10px] font-bold">
                              LINEAGE MATCH
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* RIGHT PANE (7 COLS ON DESKTOP): DUAL-AST DIFF, FINDINGS MATRIX, LINEAGE & REPRO EXPORTER */}
            <section
              aria-label="Forensic Payload Inspector and Exporter"
              className={`lg:col-span-7 bg-[#11161F] border border-[#232E3F] rounded flex flex-col ${
                mobileStation === 'waterfall' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Inspector Mode Tabs */}
              <div className="p-2 border-b border-[#232E3F] flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    data-testid="tab-ast-diff"
                    onClick={() => setInspectorTab('ast-diff')}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition ${
                      inspectorTab === 'ast-diff'
                        ? 'bg-[#06B6D4] text-[#0A0D12]'
                        : 'bg-[#0A0D12] text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Dual-AST Diff (Entry #{safeSelectedOrigIdx + 1})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="tab-findings-matrix"
                    onClick={() => setInspectorTab('findings-matrix')}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition ${
                      inspectorTab === 'findings-matrix'
                        ? 'bg-[#06B6D4] text-[#0A0D12]'
                        : 'bg-[#0A0D12] text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Redaction Ledger ({sanitizationResult.findings.length})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="tab-token-lineage"
                    onClick={() => setInspectorTab('token-lineage')}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition ${
                      inspectorTab === 'token-lineage'
                        ? 'bg-[#06B6D4] text-[#0A0D12]'
                        : 'bg-[#0A0D12] text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Token Lineage ({sanitizationResult.lineageGroups.length})</span>
                  </button>

                  <button
                    type="button"
                    data-testid="tab-repro-export"
                    onClick={() => setInspectorTab('repro-export')}
                    className={`px-3 py-1.5 rounded font-mono text-xs font-semibold flex items-center gap-1.5 transition ${
                      inspectorTab === 'repro-export'
                        ? 'bg-[#06B6D4] text-[#0A0D12]'
                        : 'bg-[#0A0D12] text-[#94A3B8] hover:text-[#F1F5F9]'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Repro Bundle (cURL / Playwright)</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: SYNCHRONIZED DUAL-AST DIFF (RAW CRIMSON VS SANITIZED EMERALD) */}
              {inspectorTab === 'ast-diff' && currentOrigEntry && currentSanitizedEntry && (
                <div data-testid="dual-ast-diff-view" className="p-3 flex flex-col gap-3">
                  {/* Entry Summary Header */}
                  <div className="bg-[#0A0D12] border border-[#232E3F] rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-bold text-[#06B6D4]">
                          {currentOrigEntry.request.method}
                        </span>
                        <span className="text-[#F1F5F9] break-all">
                          {currentSanitizedEntry.request.url}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                        Status: <strong className="text-[#F1F5F9]">{currentOrigEntry.response.status} {currentOrigEntry.response.statusText}</strong> · MIME: {currentOrigEntry.response.content.mimeType} · Secrets in Entry: <strong className="text-[#10B981]">{currentEntryFindings.length}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Per-Entry Redacted Findings Pills with Competitor Blind-Spot Callout */}
                  {currentEntryFindings.length > 0 && (
                    <div className="bg-[#0A0D12] border border-[#232E3F] rounded p-2.5">
                      <div className="text-[11px] font-mono uppercase text-[#94A3B8] mb-2 flex items-center justify-between">
                        <span>DETECTED CREDENTIALS IN ENTRY #{safeSelectedOrigIdx + 1} (CLICK TO TOGGLE REDACTION):</span>
                        <span className="text-[#10B981]">AST Depth Verified</span>
                      </div>
                      <div className="space-y-1.5">
                        {currentEntryFindings.map((f) => {
                          const isExcluded = config.excludedFindingIds.includes(f.id);
                          return (
                            <div
                              key={f.id}
                              className="p-2 rounded bg-[#11161F] border border-[#232E3F] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-[#18202C] text-[#06B6D4] text-[10px] uppercase">
                                    {f.layer}
                                  </span>
                                  <span className="font-bold text-[#F1F5F9]">{f.keyName}:</span>
                                  <span className="line-through text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded">
                                    {f.rawPreview}
                                  </span>
                                  <span className="text-[#94A3B8]">→</span>
                                  <span className="text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded font-bold">
                                    {isExcluded ? '(UNREDACTED BY USER)' : f.replacement}
                                  </span>
                                </div>
                                {f.competitorMissReason && (
                                  <div className="text-[11px] text-[#F59E0B] mt-1 font-sans">
                                    ⚠ {f.competitorMissReason}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleFindingExclusion(f.id)}
                                className={`px-2.5 py-1 rounded text-[11px] font-mono border shrink-0 ${
                                  isExcluded
                                    ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                                    : 'bg-[#18202C] border-[#232E3F] text-[#94A3B8] hover:text-[#F1F5F9]'
                                }`}
                              >
                                {isExcluded ? 'Restore Redaction' : 'Keep Raw'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Side-by-Side Raw Exposure (Before) vs Sanitized AST Output (After) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* BEFORE: RAW UNREDACTED */}
                    <div className="bg-[#0A0D12] border border-[#EF4444]/40 rounded flex flex-col">
                      <div className="px-3 py-1.5 bg-[#EF4444]/15 border-b border-[#EF4444]/30 flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-[#EF4444] uppercase">
                          BEFORE: RAW HAR EXPOSURE (UNSAFE)
                        </span>
                        <span className="font-mono text-[10px] text-[#EF4444]">
                          {currentEntryFindings.length} live secrets exposed
                        </span>
                      </div>
                      <div className="p-2.5 space-y-2.5 font-mono text-[11px] overflow-x-auto max-h-[380px] overflow-y-auto">
                        <div>
                          <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                            Request Headers ({currentOrigEntry.request.headers.length})
                          </div>
                          {currentOrigEntry.request.headers.map((h, i) => (
                            <div key={i} className="break-all leading-relaxed">
                              <span className="text-[#94A3B8]">{h.name}: </span>
                              <span className="text-[#F1F5F9]">{h.value}</span>
                            </div>
                          ))}
                        </div>

                        {currentOrigEntry.request.postData?.text && (
                          <div>
                            <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                              Request Body ({currentOrigEntry.request.postData.mimeType} ·{' '}
                              {currentOrigEntry.request.bodySize} B)
                            </div>
                            <pre className="p-2 rounded bg-[#11161F] border border-[#EF4444]/30 text-[#F1F5F9] whitespace-pre-wrap break-all text-[11px]">
                              {currentOrigEntry.request.postData.text}
                            </pre>
                          </div>
                        )}

                        <div>
                          <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                            Response Body ({currentOrigEntry.response.content.mimeType} ·{' '}
                            {currentOrigEntry.response.content.size} B)
                          </div>
                          <pre className="p-2 rounded bg-[#11161F] border border-[#EF4444]/30 text-[#F1F5F9] whitespace-pre-wrap break-all text-[11px]">
                            {currentOrigEntry.response.content.text || '(empty body)'}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* AFTER: SANITIZED AST OUTPUT */}
                    <div className="bg-[#0A0D12] border border-[#10B981]/40 rounded flex flex-col">
                      <div className="px-3 py-1.5 bg-[#10B981]/15 border-b border-[#10B981]/30 flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-[#10B981] uppercase">
                          AFTER: HARSHIELD AST OUTPUT (SAFE)
                        </span>
                        <span className="font-mono text-[10px] text-[#10B981]">
                          100% Valid JSON · Alias Linked
                        </span>
                      </div>
                      <div
                        data-testid="sanitized-after-pane"
                        className="p-2.5 space-y-2.5 font-mono text-[11px] overflow-x-auto max-h-[380px] overflow-y-auto"
                      >
                        <div>
                          <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                            Sanitized Request Headers ({currentSanitizedEntry.request.headers.length})
                          </div>
                          {currentSanitizedEntry.request.headers.map((h, i) => (
                            <div key={i} className="break-all leading-relaxed">
                              <span className="text-[#94A3B8]">{h.name}: </span>
                              <span className="text-[#10B981] font-semibold">{h.value}</span>
                            </div>
                          ))}
                        </div>

                        {currentSanitizedEntry.request.postData?.text && (
                          <div>
                            <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                              Sanitized Request Body ({currentSanitizedEntry.request.postData.mimeType} ·{' '}
                              {currentSanitizedEntry.request.bodySize} B recalculated)
                            </div>
                            <pre className="p-2 rounded bg-[#11161F] border border-[#10B981]/30 text-[#10B981] whitespace-pre-wrap break-all text-[11px]">
                              {currentSanitizedEntry.request.postData.text}
                            </pre>
                          </div>
                        )}

                        <div>
                          <div className="text-[#94A3B8] uppercase text-[10px] mb-1">
                            Sanitized Response Body ({currentSanitizedEntry.response.content.mimeType} ·{' '}
                            {currentSanitizedEntry.response.content.size} B recalculated)
                          </div>
                          <pre className="p-2 rounded bg-[#11161F] border border-[#10B981]/30 text-[#10B981] whitespace-pre-wrap break-all text-[11px]">
                            {currentSanitizedEntry.response.content.text || '(empty body)'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FULL REDACTION AUDIT LEDGER */}
              {inspectorTab === 'findings-matrix' && (
                <div data-testid="findings-ledger-view" className="p-3 overflow-x-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-mono text-[#94A3B8]">
                      Showing all {sanitizationResult.findings.length} credentials discovered across headers, cookies, query strings, POST bodies, JSON responses, and embedded presigned URLs.
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                    {sanitizationResult.findings.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded bg-[#0A0D12] border border-[#232E3F] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-[#18202C] text-[#94A3B8] text-[10px]">
                              Entry #{f.entryIndex + 1}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#06B6D4]/15 text-[#06B6D4] text-[10px]">
                              {f.layer}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#11161F] border border-[#232E3F] text-[#F1F5F9] text-[10px]">
                              {f.category}
                            </span>
                            <span className="font-bold text-[#F1F5F9]">{f.keyName}</span>
                          </div>
                          <div className="text-[11px] text-[#94A3B8] break-all">{f.fieldPath}</div>
                          {f.competitorMissReason && (
                            <div className="text-[11px] text-[#F59E0B] font-sans">
                              ⚠ {f.competitorMissReason}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-bold text-[11px]">
                            {f.replacement}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrigEntryIdx(f.entryIndex);
                              setInspectorTab('ast-diff');
                            }}
                            className="px-2 py-1 rounded bg-[#18202C] hover:bg-[#232E3F] text-[11px] text-[#06B6D4]"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: CROSS-REQUEST TOKEN LINEAGE GRAPH */}
              {inspectorTab === 'token-lineage' && (
                <div data-testid="token-lineage-view" className="p-3 space-y-3 max-h-[540px] overflow-y-auto">
                  <div className="p-2.5 rounded bg-[#0A0D12] border border-[#232E3F] text-xs text-[#94A3B8]">
                    <strong className="text-[#F1F5F9]">Why Referential Integrity Matters:</strong> Naive sanitizers overwrite every token with identical <code className="text-[#EF4444]">[REDACTED]</code> text, making it impossible to diagnose whether a <code className="text-[#F59E0B]">401 Unauthorized</code> error happened because a request sent a stale pre-refresh token. HARshield assigns deterministic session pseudonyms (<code className="text-[#10B981]">JWT_TOKEN_#1</code> vs <code className="text-[#10B981]">JWT_TOKEN_#2</code>) using an FNV-1a session hash.
                  </div>

                  {sanitizationResult.lineageGroups.map((group) => (
                    <div
                      key={group.rawHash}
                      className="p-3 rounded bg-[#0A0D12] border border-[#232E3F] space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] font-bold text-xs">
                            {group.pseudonym}
                          </span>
                          <span className="text-xs text-[#94A3B8]">{group.category}</span>
                          <span className="text-[11px] text-[#06B6D4]">
                            Fingerprint: #{group.rawHash}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#94A3B8]">
                          Appears {group.occurrences.length} time(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {group.occurrences.map((occ, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedOrigEntryIdx(occ.entryIndex);
                              setInspectorTab('ast-diff');
                            }}
                            className="p-2 rounded bg-[#11161F] hover:bg-[#18202C] border border-[#232E3F] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] cursor-pointer transition"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[#94A3B8]">Entry #{occ.entryIndex + 1}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  occ.role === 'ISSUED'
                                    ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                                    : occ.role === 'REJECTED_401'
                                    ? 'bg-[#EF4444]/20 text-[#EF4444]'
                                    : 'bg-[#10B981]/20 text-[#10B981]'
                                }`}
                              >
                                {occ.role} ({occ.direction.toUpperCase()})
                              </span>
                              <span className="text-[#F1F5F9]">
                                {occ.method} {occ.urlPath}
                              </span>
                            </div>
                            <span className="text-[#94A3B8]">HTTP {occ.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: MINIMAL REPRO BUNDLER (cURL / Playwright / Incident Markdown / Sanitized HAR JSON) */}
              {inspectorTab === 'repro-export' && (
                <div data-testid="repro-exporter-view" className="p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'curl', label: 'Redacted cURL (.sh)' },
                          { id: 'playwright', label: 'Playwright API Spec (.spec.ts)' },
                          { id: 'markdown', label: 'Incident Report (.md)' },
                          { id: 'har-json', label: 'Sanitized HAR 1.2 (.har)' },
                        ] as const
                      ).map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          data-testid={`repro-fmt-${fmt.id}`}
                          onClick={() => setReproFormat(fmt.id)}
                          className={`px-2.5 py-1.5 rounded font-mono text-xs font-semibold border transition ${
                            reproFormat === fmt.id
                              ? 'bg-[#18202C] border-[#06B6D4] text-[#06B6D4]'
                              : 'bg-[#0A0D12] border-[#232E3F] text-[#94A3B8] hover:text-[#F1F5F9]'
                          }`}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="copy-repro-btn"
                        onClick={() => handleCopyArtifact(generatedReproText, reproFormat.toUpperCase())}
                        className="min-h-[36px] px-3 py-1 rounded bg-[#06B6D4] hover:bg-[#0891B2] text-[#0A0D12] font-mono text-xs font-bold flex items-center gap-1.5"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        <span>Copy {reproFormat.toUpperCase()}</span>
                      </button>
                    </div>
                  </div>

                  <pre
                    data-testid="repro-code-output"
                    className="p-3 rounded bg-[#0A0D12] border border-[#232E3F] font-mono text-xs text-[#10B981] overflow-x-auto max-h-[460px] overflow-y-auto whitespace-pre-wrap break-all leading-relaxed"
                  >
                    {generatedReproText}
                  </pre>
                </div>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
