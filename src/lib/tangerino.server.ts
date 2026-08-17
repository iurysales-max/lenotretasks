import type { EmployeeDay, PunchDayResult, PunchPair } from "./tangerino-types";

const TZ_OFFSET_MINUTES = -180; // America/Sao_Paulo (UTC-3)

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/19XowWm9jps7q9F9GCI8ihibVM-d58PbuBtxmKOcPL5E/export?format=csv";

export function dayRangeMillis(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const startUtc = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0) - TZ_OFFSET_MINUTES * 60_000;
  return { start: startUtc, end: startUtc + 24 * 60 * 60 * 1000 - 1000 };
}

function toLocalTime(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const shifted = new Date(ms + TZ_OFFSET_MINUTES * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface RawPunch {
  dateIn?: number | null;
  dateOut?: number | null;
  status?: string | null;
  plataform?: string | null;
  employeeId?: number;
  employeeName?: string;
  employeeEmail?: string | null;
  employeePin?: string | null;
  employeeExternalId?: string | null;
  excluded?: boolean;
  localIn?: string | null;
  localOut?: string | null;
}

/** Builds EmployeeDay rows from raw punches already scoped to a single day. */
function buildDay(
  rows: RawPunch[],
  fonte: EmployeeDay["fonte"],
  keyOf: (r: RawPunch) => string,
): EmployeeDay[] {
  const byEmployee = new Map<string, RawPunch[]>();
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.excluded) continue;
    const k = keyOf(r);
    if (!k) continue;
    const dedupe = `${k}|${r.dateIn ?? ""}|${r.dateOut ?? ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const list = byEmployee.get(k) ?? [];
    list.push(r);
    byEmployee.set(k, list);
  }

  const employees: EmployeeDay[] = [];
  for (const list of byEmployee.values()) {
    list.sort((a, b) => (a.dateIn ?? 0) - (b.dateIn ?? 0));
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const pairs: PunchPair[] = list.map((r) => ({
      in: toLocalTime(r.dateIn),
      out: toLocalTime(r.dateOut),
      localIn: r.localIn ?? null,
      localOut: r.localOut ?? null,
    }));

    let workedMinutes = 0;
    for (const r of list) {
      if (r.dateIn && r.dateOut) workedMinutes += Math.round((r.dateOut - r.dateIn) / 60_000);
    }

    const intervalos: EmployeeDay["intervalos"] = [];
    let breakMinutes = 0;
    for (let i = 0; i < list.length - 1; i += 1) {
      const outMs = list[i]!.dateOut;
      const nextIn = list[i + 1]!.dateIn;
      if (outMs && nextIn && nextIn > outMs) {
        const minutes = Math.round((nextIn - outMs) / 60_000);
        breakMinutes += minutes;
        intervalos.push({ start: toLocalTime(outMs)!, end: toLocalTime(nextIn)!, minutes });
      }
    }

    employees.push({
      employeeId: first.employeeId ?? 0,
      name: first.employeeName ?? "—",
      email: first.employeeEmail ?? null,
      pin: first.employeePin ?? null,
      externalId: first.employeeExternalId ?? null,
      entrada: toLocalTime(first.dateIn),
      saida: toLocalTime(last.dateOut),
      intervalos,
      pairs,
      workedMinutes,
      breakMinutes,
      pendente: list.some((r) => (r.status ?? "") !== "APPROVED") || list.some((r) => !r.dateOut),
      origem: first.plataform ?? null,
      localEntrada: first.localIn ?? null,
      localSaida: last.localOut ?? null,
      fonte,
    });
  }

  employees.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return employees;
}

export async function fetchApiDay(date: string): Promise<EmployeeDay[]> {
  const auth = process.env["TANGERINO_BASIC_AUTH"];
  if (!auth) return [];
  const { start, end } = dayRangeMillis(date);
  const url =
    `https://apis.tangerino.com.br/punch/?startDateInMillis=${start}&endDateInMillis=${end}` +
    `&size=500&showFired=false`;
  const res = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Erro ao consultar o Tangerino (HTTP ${res.status})`);
  const json = (await res.json()) as { content?: RawPunch[] };
  return buildDay(json.content ?? [], "api", (r) => String(r.employeeId ?? ""));
}

/** Minimal CSV parser handling quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** "11/08/2026 17:37:00" -> epoch ms in America/Sao_Paulo */
function parseBrDateTime(value: string): number | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, d, mo, y, hh, mi] = m;
  return (
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mi ?? 0), 0) -
    TZ_OFFSET_MINUTES * 60_000
  );
}

export async function fetchSheetDay(date: string): Promise<EmployeeDay[]> {
  const res = await fetch(SHEET_CSV_URL, { headers: { Accept: "text/csv" } });
  if (!res.ok) return [];
  const table = parseCsv(await res.text());
  const header = table.shift();
  if (!header) return [];
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const cName = idx("colaborador");
  const cExt = idx("id externo");
  const cIn = idx("entrada");
  const cOut = idx("saída") >= 0 ? idx("saída") : idx("saida");
  const cLocIn = idx("local entrada");
  const cLocOut = idx("local saída") >= 0 ? idx("local saída") : idx("local saida");
  const cStatus = idx("status");
  const cPlat = idx("plataforma");

  const { start, end } = dayRangeMillis(date);
  const raw: RawPunch[] = [];
  for (const r of table) {
    const inMs = parseBrDateTime(r[cIn] ?? "");
    if (!inMs || inMs < start || inMs > end) continue;
    const outMs = parseBrDateTime(r[cOut] ?? "");
    raw.push({
      employeeId: Number(r[cExt] ?? 0) || 0,
      employeeName: (r[cName] ?? "").trim(),
      employeeExternalId: (r[cExt] ?? "").trim() || null,
      dateIn: inMs,
      dateOut: outMs,
      status: (r[cStatus] ?? "").trim() || null,
      plataform: (r[cPlat] ?? "").trim() || null,
      localIn: (r[cLocIn] ?? "").trim() || null,
      localOut: (r[cLocOut] ?? "").trim() || null,
    });
  }
  return buildDay(raw, "planilha", (r) => (r.employeeName ?? "").toLowerCase());
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export async function getPunchDayMerged(date: string): Promise<PunchDayResult> {
  const [apiResult, sheetResult] = await Promise.allSettled([fetchApiDay(date), fetchSheetDay(date)]);
  const api = apiResult.status === "fulfilled" ? apiResult.value : [];
  const sheet = sheetResult.status === "fulfilled" ? sheetResult.value : [];

  if (api.length === 0 && sheet.length === 0 && apiResult.status === "rejected") {
    throw apiResult.reason instanceof Error ? apiResult.reason : new Error("Falha ao consultar o ponto");
  }

  const merged = new Map<string, EmployeeDay>();
  for (const e of sheet) merged.set(norm(e.name), e);
  for (const e of api) {
    const key = norm(e.name);
    const fromSheet = merged.get(key);
    merged.set(key, fromSheet ? { ...e, localEntrada: e.localEntrada ?? fromSheet.localEntrada, localSaida: e.localSaida ?? fromSheet.localSaida } : e);
  }

  const employees = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { date, total: employees.length, employees };
}
