import { HarFile } from '../types/har';

export interface ParseHarOutcome {
  ok: boolean;
  har?: HarFile;
  errorTitle?: string;
  errorDetail?: string;
  errorLine?: number;
  errorCol?: number;
  canAutoRepair?: boolean;
  repairedHar?: HarFile;
  repairedNote?: string;
}

function computeLineAndCol(text: string, position: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(position, text.length));
  const upTo = text.slice(0, clamped);
  const lines = upTo.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1,
  };
}

/**
 * Attempts to salvage a truncated or trailing-comma corrupted HAR JSON string
 * by recovering all complete entry objects inside "entries": [ ... ]
 */
export function attemptRepairCorruptedHar(rawText: string): { har: HarFile; note: string } | null {
  try {
    // Case 1: trailing commas before } or ]
    const cleanedCommas = rawText.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(cleanedCommas);
    if (parsed?.log?.entries && Array.isArray(parsed.log.entries)) {
      return {
        har: parsed as HarFile,
        note: `Repaired trailing JSON comma syntax errors (${parsed.log.entries.length} entries recovered).`,
      };
    }
  } catch {
    // Continue to truncation recovery
  }

  // Case 2: Truncated file mid-entry inside "entries": [
  const entriesIdx = rawText.indexOf('"entries"');
  if (entriesIdx === -1) return null;
  const bracketStart = rawText.indexOf('[', entriesIdx);
  if (bracketStart === -1) return null;

  // Walk character by character inside entries array to find complete top-level entry objects
  const recoveredEntries: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;

  for (let i = bracketStart + 1; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const slice = rawText.slice(objStart, i + 1);
        try {
          const entryObj = JSON.parse(slice);
          if (entryObj && entryObj.request && entryObj.response) {
            recoveredEntries.push(entryObj);
          }
        } catch {
          // Ignore incomplete entry
        }
        objStart = -1;
      }
    }
  }

  if (recoveredEntries.length > 0) {
    return {
      har: {
        log: {
          version: '1.2',
          creator: { name: 'HARshield Auto-Repair', version: '1.0' },
          entries: recoveredEntries as HarFile['log']['entries'],
        },
      },
      note: `Recovered ${recoveredEntries.length} complete HTTP entries from truncated HAR stream.`,
    };
  }

  return null;
}

export function parseHarString(rawText: string): ParseHarOutcome {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorTitle: 'Empty HAR Input',
      errorDetail: 'The provided file or clipboard payload is empty. Drop a valid .har capture or select a diagnostic preset.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || !parsed.log || !Array.isArray(parsed.log.entries)) {
      return {
        ok: false,
        errorTitle: 'Invalid HAR 1.2 Root Schema',
        errorDetail:
          'JSON parsed successfully, but root object is missing required "log.entries" array specified by the HTTP Archive (HAR 1.2) format.',
      };
    }
    if (parsed.log.entries.length === 0) {
      return {
        ok: false,
        errorTitle: 'HAR Capture Contains 0 Entries',
        errorDetail: 'The HAR log.entries array is empty. Record network activity in DevTools before exporting.',
      };
    }
    return {
      ok: true,
      har: parsed as HarFile,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const posMatch = msg.match(/position\s+(\d+)/i);
    let line = 1;
    let col = 1;
    if (posMatch) {
      const lc = computeLineAndCol(trimmed, parseInt(posMatch[1], 10));
      line = lc.line;
      col = lc.col;
    }

    const repairAttempt = attemptRepairCorruptedHar(trimmed);
    return {
      ok: false,
      errorTitle: 'Malformed or Truncated HAR JSON Syntax',
      errorDetail: `${msg} (near line ${line}, column ${col}). Large browser HAR exports often truncate if saved while background streams are still open.`,
      errorLine: line,
      errorCol: col,
      canAutoRepair: Boolean(repairAttempt),
      repairedHar: repairAttempt?.har,
      repairedNote: repairAttempt?.note,
    };
  }
}
