import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { type CreatePlayerInput, type MatchCategory, type PlayerGender } from '@/lib/firestore/types';

export type ImportMode = 'singles' | 'doubles';

type ImportedPlayer = CreatePlayerInput & {
  partnerToken?: string;
};

type ParseResult = {
  mode: ImportMode;
  players: ImportedPlayer[];
  warnings: string[];
};

const VALID_CATEGORIES: MatchCategory[] = ['MS', 'WS', 'MD', 'WD', 'XD'];

function normalizeHeaderKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeGender(value: unknown): PlayerGender | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'm' || v === 'male' || v === 'man' || v === 'boy') return 'M';
  if (v === 'f' || v === 'female' || v === 'woman' || v === 'girl') return 'F';
  return null;
}

function parseCategories(raw: unknown, enabledCategories: MatchCategory[]): MatchCategory[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((item) => item.trim().toUpperCase() as MatchCategory)
    .filter((item) => VALID_CATEGORIES.includes(item) && enabledCategories.includes(item));
}

function readRowsFromSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      mapped[normalizeHeaderKey(key)] = value;
    });
    return mapped;
  });
}

function parseSinglesRows(
  rows: Record<string, unknown>[],
  enabledCategories: MatchCategory[],
): ParseResult {
  const warnings: string[] = [];
  const players: ImportedPlayer[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const name = String(row.name ?? '').trim();
    const gender = normalizeGender(row.gender);
    const categories = parseCategories(row.categories, enabledCategories);
    const department = String(row.department ?? '').trim();
    const seeded =
      typeof row.seeded === 'string'
        ? ['true', '1', 'yes', 'y'].includes(row.seeded.toLowerCase())
        : Boolean(row.seeded);

    if (!name) {
      warnings.push(`Row ${line}: missing name (skipped).`);
      return;
    }

    if (!gender) {
      warnings.push(`Row ${line}: invalid gender for "${name}" (skipped).`);
      return;
    }

    const resolvedCategories = categories.length > 0 ? categories : enabledCategories;
    players.push({
      name,
      gender,
      categories: resolvedCategories,
      department: department || undefined,
      seeded,
      partnerId: null,
      groupId: null,
    });
  });

  return { mode: 'singles', players, warnings };
}

function parseDoublesRows(
  rows: Record<string, unknown>[],
  enabledCategories: MatchCategory[],
): ParseResult {
  const warnings: string[] = [];
  const players: ImportedPlayer[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const categoryCandidate = String(row.category ?? '').trim().toUpperCase() as MatchCategory;
    const category =
      VALID_CATEGORIES.includes(categoryCandidate) && enabledCategories.includes(categoryCandidate)
        ? categoryCandidate
        : 'XD';

    const p1Name = String(row.player1_name ?? '').trim();
    const p2Name = String(row.player2_name ?? '').trim();
    const p1Gender = normalizeGender(row.player1_gender);
    const p2Gender = normalizeGender(row.player2_gender);
    const p1Department = String(row.player1_department ?? '').trim();
    const p2Department = String(row.player2_department ?? '').trim();

    if (!p1Name || !p2Name) {
      warnings.push(`Row ${line}: missing player names (skipped).`);
      return;
    }
    if (!p1Gender || !p2Gender) {
      warnings.push(`Row ${line}: invalid player gender values (skipped).`);
      return;
    }

    const partnerToken = `pair-${index}-${Date.now()}`;
    players.push({
      name: p1Name,
      gender: p1Gender,
      categories: [category],
      department: p1Department || undefined,
      seeded: false,
      partnerId: null,
      groupId: null,
      partnerToken,
    });
    players.push({
      name: p2Name,
      gender: p2Gender,
      categories: [category],
      department: p2Department || undefined,
      seeded: false,
      partnerId: null,
      groupId: null,
      partnerToken,
    });
  });

  return { mode: 'doubles', players, warnings };
}

function detectMode(rows: Record<string, unknown>[]): ImportMode {
  const hasDoublesColumns = rows.some(
    (row) => 'player1_name' in row || 'player2_name' in row || 'category' in row,
  );
  return hasDoublesColumns ? 'doubles' : 'singles';
}

function parseWorkbook(
  workbook: XLSX.WorkBook,
  enabledCategories: MatchCategory[],
): ParseResult {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = readRowsFromSheet(sheet);
  const mode = detectMode(rows);
  return mode === 'doubles'
    ? parseDoublesRows(rows, enabledCategories)
    : parseSinglesRows(rows, enabledCategories);
}

export function parsePlayersWorkbookFromBase64(
  base64: string,
  enabledCategories: MatchCategory[],
): ParseResult {
  const workbook = XLSX.read(base64, { type: 'base64' });
  return parseWorkbook(workbook, enabledCategories);
}

export function parsePlayersWorkbookFromArrayBuffer(
  data: ArrayBuffer,
  enabledCategories: MatchCategory[],
): ParseResult {
  const workbook = XLSX.read(data, { type: 'array' });
  return parseWorkbook(workbook, enabledCategories);
}

function singlesTemplateSheet() {
  return XLSX.utils.json_to_sheet([
    {
      name: 'Abhijit',
      gender: 'M',
      department: 'Engineering',
      categories: 'MS, XD',
      seeded: 'false',
    },
    {
      name: 'Vignesh',
      gender: 'M',
      department: 'Finance',
      categories: 'MS',
      seeded: 'true',
    },
  ]);
}

function doublesTemplateSheet() {
  return XLSX.utils.json_to_sheet([
    {
      category: 'MD',
      player1_name: 'Abhijit',
      player1_gender: 'M',
      player1_department: 'Engineering',
      player2_name: 'Rahul',
      player2_gender: 'M',
      player2_department: 'Operations',
    },
    {
      category: 'XD',
      player1_name: 'Ananya',
      player1_gender: 'F',
      player1_department: 'HR',
      player2_name: 'Vignesh',
      player2_gender: 'M',
      player2_department: 'Finance',
    },
  ]);
}

function templateWorkbook(type: ImportMode): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = type === 'singles' ? singlesTemplateSheet() : doublesTemplateSheet();
  XLSX.utils.book_append_sheet(wb, ws, type === 'singles' ? 'Singles' : 'Doubles');
  return wb;
}

export async function downloadTemplateExcel(type: ImportMode): Promise<void> {
  const workbook = templateWorkbook(type);
  const filename = `loveall-${type}-template.xlsx`;

  if (Platform.OS === 'web') {
    const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const blob = new Blob([array], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const target = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Share template',
    });
  }
}
