import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Workbook } from "exceljs";

import {
  type CreatePlayerInput,
  type MatchCategory,
  type PlayerGender,
} from "@/lib/firestore/types";

export type ImportMode = "singles" | "doubles";

type ImportedPlayer = CreatePlayerInput & {
  partnerToken?: string;
};

export type ParseResult = {
  mode: ImportMode;
  players: ImportedPlayer[];
  warnings: string[];
};

const VALID_CATEGORIES: MatchCategory[] = ["MS", "WS", "MD", "WD", "XD"];

function normalizeHeaderKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeGender(value: unknown): PlayerGender | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "m" || v === "male" || v === "man" || v === "boy") return "M";
  if (v === "f" || v === "female" || v === "woman" || v === "girl") return "F";
  return null;
}

function parseCategories(
  raw: unknown,
  enabledCategories: MatchCategory[],
): MatchCategory[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase() as MatchCategory)
    .filter(
      (item) =>
        VALID_CATEGORIES.includes(item) && enabledCategories.includes(item),
    );
}

function getCellValue(cell: { value: unknown } | undefined): unknown {
  if (!cell) return "";
  return cell.value;
}

async function parseWorkbook(
  workbook: Workbook,
  enabledCategories: MatchCategory[],
): Promise<ParseResult> {
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    return { mode: "singles", players: [], warnings: ["No worksheet found"] };
  }

  const headers: string[] = [];
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell: { value: unknown }) => {
    headers.push(normalizeHeaderKey(String(cell.value ?? "")));
  });
  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow(
    (
      row: {
        eachCell: (
          cb: (cell: { value: unknown }, colNumber?: number) => void,
        ) => void;
      },
      rowNumber: number,
    ) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell: { value: unknown }, colNumber?: number) => {
        const header = headers[(colNumber ?? 1) - 1];
        if (header) {
          rowData[header] = getCellValue(cell);
        }
      });
      rows.push(rowData);
    },
  );

  const hasDoublesColumns = rows.some(
    (row) =>
      "player1_name" in row || "player2_name" in row || "category" in row,
  );
  const mode = hasDoublesColumns ? "doubles" : "singles";

  if (mode === "doubles") {
    return parseDoublesRows(rows, enabledCategories);
  }
  return parseSinglesRows(rows, enabledCategories);
}

function parseSinglesRows(
  rows: Record<string, unknown>[],
  enabledCategories: MatchCategory[],
): ParseResult {
  const warnings: string[] = [];
  const players: ImportedPlayer[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const name = String(row.name ?? "").trim();
    const gender = normalizeGender(row.gender);
    const categories = parseCategories(row.categories, enabledCategories);
    const department = String(row.department ?? "").trim();
    const seeded =
      typeof row.seeded === "string"
        ? ["true", "1", "yes", "y"].includes(row.seeded.toLowerCase())
        : Boolean(row.seeded);

    if (!name) {
      warnings.push(`Row ${line}: missing name (skipped).`);
      return;
    }

    if (!gender) {
      warnings.push(`Row ${line}: invalid gender for "${name}" (skipped).`);
      return;
    }

    const resolvedCategories =
      categories.length > 0 ? categories : enabledCategories;
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

  return { mode: "singles", players, warnings };
}

function parseDoublesRows(
  rows: Record<string, unknown>[],
  enabledCategories: MatchCategory[],
): ParseResult {
  const warnings: string[] = [];
  const players: ImportedPlayer[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const categoryCandidate = String(row.category ?? "")
      .trim()
      .toUpperCase() as MatchCategory;
    const category =
      VALID_CATEGORIES.includes(categoryCandidate) &&
      enabledCategories.includes(categoryCandidate)
        ? categoryCandidate
        : "XD";

    const p1Name = String(row.player1_name ?? "").trim();
    const p2Name = String(row.player2_name ?? "").trim();
    const p1Gender = normalizeGender(row.player1_gender);
    const p2Gender = normalizeGender(row.player2_gender);
    const p1Department = String(row.player1_department ?? "").trim();
    const p2Department = String(row.player2_department ?? "").trim();

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

  return { mode: "doubles", players, warnings };
}

export async function parsePlayersWorkbookFromBase64(
  base64: string,
  enabledCategories: MatchCategory[],
): Promise<ParseResult> {
  const workbook = new Workbook();
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await workbook.xlsx.load(bytes.buffer);
  return parseWorkbook(workbook, enabledCategories);
}

export async function parsePlayersWorkbookFromArrayBuffer(
  data: ArrayBuffer,
  enabledCategories: MatchCategory[],
): Promise<ParseResult> {
  const workbook = new Workbook();
  await workbook.xlsx.load(data);
  return parseWorkbook(workbook, enabledCategories);
}

function createSinglesTemplate(): Workbook {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Singles");

  worksheet.columns = [
    { header: "name", key: "name", width: 20 },
    { header: "gender", key: "gender", width: 10 },
    { header: "department", key: "department", width: 20 },
    { header: "categories", key: "categories", width: 15 },
    { header: "seeded", key: "seeded", width: 10 },
  ];

  worksheet.addRows([
    {
      name: "Abhijit",
      gender: "M",
      department: "Engineering",
      categories: "MS, XD",
      seeded: "false",
    },
    {
      name: "Vignesh",
      gender: "M",
      department: "Finance",
      categories: "MS",
      seeded: "true",
    },
  ]);

  return workbook;
}

function createDoublesTemplate(): Workbook {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Doubles");

  worksheet.columns = [
    { header: "category", key: "category", width: 10 },
    { header: "player1_name", key: "player1_name", width: 20 },
    { header: "player1_gender", key: "player1_gender", width: 15 },
    { header: "player1_department", key: "player1_department", width: 20 },
    { header: "player2_name", key: "player2_name", width: 20 },
    { header: "player2_gender", key: "player2_gender", width: 15 },
    { header: "player2_department", key: "player2_department", width: 20 },
  ];

  worksheet.addRows([
    {
      category: "MD",
      player1_name: "Abhijit",
      player1_gender: "M",
      player1_department: "Engineering",
      player2_name: "Rahul",
      player2_gender: "M",
      player2_department: "Operations",
    },
    {
      category: "XD",
      player1_name: "Ananya",
      player1_gender: "F",
      player1_department: "HR",
      player2_name: "Vignesh",
      player2_gender: "M",
      player2_department: "Finance",
    },
  ]);

  return workbook;
}

export async function downloadTemplateExcel(type: ImportMode): Promise<void> {
  const workbook =
    type === "singles" ? createSinglesTemplate() : createDoublesTemplate();
  const filename = `loveall-${type}-template.xlsx`;

  if (Platform.OS === "web") {
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([arrayBuffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await workbook.xlsx.writeBuffer();
  const buffer = base64 as ArrayBuffer;
  const base64String = btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      "",
    ),
  );
  const target = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(target, base64String, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Share template",
    });
  }
}
