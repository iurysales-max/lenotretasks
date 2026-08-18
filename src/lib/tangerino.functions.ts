import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PunchDayResult } from "./tangerino-types";

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
