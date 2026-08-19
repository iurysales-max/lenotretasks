import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PunchDayResult, OvertimeRangeResult } from "./tangerino-types";

export type { PunchPair, EmployeeDay, PunchDayResult } from "./tangerino-types";

export const getPunchDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? "")) throw new Error("Data inválida");
    return { date: input.date };
  })
  .handler(async ({ data }): Promise<PunchDayResult> => {
    const { getPunchDayMerged } = await import("./tangerino.server");
    return getPunchDayMerged(data.date);
  });

export type { OvertimeDay, OvertimeEmployee, OvertimeRangeResult } from "./tangerino-types";

export const getOvertimePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { start: string; end: string; dailyMinutes?: number }) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(input?.start ?? "") || !re.test(input?.end ?? "")) throw new Error("Período inválido");
    if (input.start > input.end) throw new Error("A data inicial deve ser anterior à final");
    return {
      start: input.start,
      end: input.end,
      dailyMinutes: Math.round(input.dailyMinutes ?? 508.8),
    };
  })
  .handler(async ({ data }): Promise<OvertimeRangeResult> => {
    const { getOvertimeRange } = await import("./tangerino.server");
    return getOvertimeRange(data.start, data.end, data.dailyMinutes);
  });
