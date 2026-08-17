import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PunchPair {
  in: string | null;
  out: string | null;
}

export interface EmployeeDay {
  employeeId: number;
  name: string;
  email: string | null;
  pin: string | null;
  externalId: string | null;
  entrada: string | null;
  saida: string | null;
  intervalos: { start: string; end: string; minutes: number }[];
  pairs: PunchPair[];
  workedMinutes: number;
  breakMinutes: number;
  pendente: boolean;
  origem: string | null;
}

export interface PunchDayResult {
  date: string;
  total: number;
  employees: EmployeeDay[];
}

const TZ_OFFSET_MINUTES = -180; // America/Sao_Paulo (UTC-3)

function dayRangeMillis(date: string) {
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
  date?: string;
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
}

export const getPunchDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? "")) throw new Error("Data inválida");
    return { date: input.date };
  })
  .handler(async ({ data }): Promise<PunchDayResult> => {
    const auth = process.env["TANGERINO_BASIC_AUTH"];
    if (!auth) throw new Error("Credencial do Tangerino não configurada");

    const { start, end } = dayRangeMillis(data.date);
    const url =
      `https://apis.tangerino.com.br/punch/?startDateInMillis=${start}&endDateInMillis=${end}` +
      `&size=500&showFired=false`;
    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Erro ao consultar o Tangerino (HTTP ${res.status})`);
    const json = (await res.json()) as { content?: RawPunch[] };
    const rows: RawPunch[] = json.content ?? [];

    const byEmployee = new Map<number, RawPunch[]>();
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.excluded) continue;
      const id = r.employeeId;
      if (!id) continue;
      const key = `${id}|${r.dateIn ?? ""}|${r.dateOut ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = byEmployee.get(id) ?? [];
      list.push(r);
      byEmployee.set(id, list);
    }


    const employees: EmployeeDay[] = [];
    for (const [id, list] of byEmployee) {
      list.sort((a, b) => (a.dateIn ?? 0) - (b.dateIn ?? 0));
      const first = list[0]!;
      const pairs: PunchPair[] = list.map((r) => ({ in: toLocalTime(r.dateIn), out: toLocalTime(r.dateOut) }));

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
        employeeId: id,
        name: first.employeeName ?? "—",
        email: first.employeeEmail ?? null,
        pin: first.employeePin ?? null,
        externalId: first.employeeExternalId ?? null,
        entrada: toLocalTime(list[0]?.dateIn),
        saida: toLocalTime(list[list.length - 1]?.dateOut),
        intervalos,
        pairs,
        workedMinutes,
        breakMinutes,
        pendente: list.some((r) => (r.status ?? "") !== "APPROVED") || list.some((r) => !r.dateOut),
        origem: first.plataform ?? null,
      });
    }

    employees.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { date: data.date, total: employees.length, employees };
  });
