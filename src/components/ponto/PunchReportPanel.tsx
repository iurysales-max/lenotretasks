import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Clock, Download, Search, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { getOvertimePeriod } from "@/lib/tangerino.functions";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const hm = (m: number) => {
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(Math.round(m));
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}`;
};

const brDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

const shiftDays = (iso: string, days: number) =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

const todayISO = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T12:00:00Z`).getTime();
  const e = new Date(`${end}T12:00:00Z`).getTime();
  for (let t = s; t <= e && out.length < 62; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const isWeekend = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

interface ReportRow {
  name: string;
  cargo: string | null;
  daysWorked: number;
  missingDates: string[];
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  netMinutes: number;
  pendentes: number;
}

export function PunchReportPanel() {
  const today = todayISO();
  const [start, setStart] = useState(() => shiftDays(today, -13));
  const [end, setEnd] = useState(today);
  const [dailyHours, setDailyHours] = useState("8.48");
  const [skipWeekend, setSkipWeekend] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [range, setRange] = useState<{ start: string; end: string; dailyMinutes: number } | null>(null);
  const fetchOvertime = useServerFn(getOvertimePeriod);

  const dailyMinutes = Math.round((Number(dailyHours.replace(",", ".")) || 8.48) * 60);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report"],
    queryFn: async () =>
      ((await supabase.from("employees").select("name,cargo,active").order("name")).data ?? []) as {
        name: string;
        cargo: string | null;
        active: boolean;
      }[],
  });

  const { data, isFetching, error } = useQuery({
    queryKey: ["punch-report", range?.start, range?.end, range?.dailyMinutes],
    queryFn: () => fetchOvertime({ data: range! }),
    enabled: !!range,
    staleTime: 5 * 60_000,
  });

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const selectedSet = useMemo(() => new Set(selected.map(norm)), [selected]);

  const periodDates = useMemo(() => {
    if (!data) return [] as string[];
    return eachDate(data.start, data.end).filter((d) => (skipWeekend ? !isWeekend(d) : true));
  }, [data, skipWeekend]);

  const rows = useMemo<ReportRow[]>(() => {
    if (!data) return [];
    const byName = new Map(data.employees.map((e) => [norm(e.name), e]));
    const base = activeEmployees.length
      ? activeEmployees.map((e) => ({ name: e.name, cargo: e.cargo }))
      : data.employees.map((e) => ({ name: e.name, cargo: null as string | null }));

    const list = base.map(({ name, cargo }) => {
      const agg = byName.get(norm(name));
      const punchedDays = new Set(
        (agg?.days ?? []).filter((d) => d.workedMinutes > 0 || d.entrada).map((d) => d.date),
      );
      const missingDates = periodDates.filter((d) => !punchedDays.has(d));
      const overtimeMinutes = agg?.overtimeMinutes ?? 0;
      const deficitMinutes = agg?.deficitMinutes ?? 0;
      return {
        name,
        cargo,
        daysWorked: agg?.daysWorked ?? 0,
        missingDates,
        workedMinutes: agg?.workedMinutes ?? 0,
        expectedMinutes: agg?.expectedMinutes ?? 0,
        overtimeMinutes,
        deficitMinutes,
        netMinutes: overtimeMinutes - deficitMinutes,
        pendentes: (agg?.days ?? []).filter((d) => d.pendente).length,
      };
    });

    const filtered = selectedSet.size === 0 ? list : list.filter((r) => selectedSet.has(norm(r.name)));
    return filtered.sort((a, b) => b.missingDates.length - a.missingDates.length || a.name.localeCompare(b.name, "pt-BR"));
  }, [data, activeEmployees, periodDates, selectedSet]);

  const totals = useMemo(
    () => ({
      colaboradores: rows.length,
      semRegistro: rows.filter((r) => r.daysWorked === 0).length,
      faltas: rows.reduce((s, r) => s + r.missingDates.length, 0),
      extras: rows.reduce((s, r) => s + r.netMinutes, 0),
    }),
    [rows],
  );

  const filteredNames = useMemo(() => {
    const t = norm(pick);
    const names = (activeEmployees.length ? activeEmployees.map((e) => e.name) : (data?.employees ?? []).map((e) => e.name));
    return names.filter((n) => (!t ? true : norm(n).includes(t))).slice(0, 200);
  }, [activeEmployees, data, pick]);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const downloadCsv = () => {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [
      "Colaborador",
      "Cargo",
      "Dias com registro",
      "Dias sem registro",
      "Datas sem registro",
      "Previsto",
      "Trabalhado",
      "Extras brutas",
      "Atrasos",
      "Extras liquidas",
      "Registros pendentes",
    ];
    const lines = rows.map((r) =>
      [
        r.name,
        r.cargo ?? "",
        r.daysWorked,
        r.missingDates.length,
        r.missingDates.map(brDate).join(" "),
        hm(r.expectedMinutes),
        hm(r.workedMinutes),
        hm(r.overtimeMinutes),
        hm(r.deficitMinutes),
        hm(r.netMinutes),
        r.pendentes,
      ].map(esc).join(";"),
    );
    const csv = `\uFEFF${header.map(esc).join(";")}\n${lines.join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ponto_${data.start}_a_${data.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Escala (horas/dia)</Label>
            <Input value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} className="w-[120px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Colaboradores</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[220px] justify-between font-normal">
                  {selected.length === 0 ? "Todos" : `${selected.length} selecionado(s)`}
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2" align="start">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
                </div>
                <ScrollArea className="h-[240px] pr-2">
                  <div className="space-y-1">
                    {filteredNames.map((n) => (
                      <label key={n} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
                        <Checkbox checked={selected.includes(n)} onCheckedChange={() => toggle(n)} />
                        <span className="truncate">{n}</span>
                      </label>
                    ))}
                    {filteredNames.length === 0 && <p className="text-sm text-muted-foreground px-2 py-4">Nenhum colaborador.</p>}
                  </div>
                </ScrollArea>
                {selected.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelected([])}>
                    Limpar seleção
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <label className="flex items-center gap-2 text-sm h-10">
            <Checkbox checked={skipWeekend} onCheckedChange={(v) => setSkipWeekend(!!v)} />
            Ignorar sábados e domingos
          </label>
          <Button onClick={() => setRange({ start, end, dailyMinutes })} disabled={isFetching}>
            <Clock className="w-4 h-4 mr-2" />
            {isFetching ? "Gerando…" : "Gerar relatório"}
          </Button>
          <Button variant="outline" onClick={downloadCsv} disabled={!data || rows.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Baixar CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Atrasos (horas a menos) são descontados das horas extras. Período máximo de 62 dias.
        </p>
      </Card>

      {error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Não foi possível gerar o relatório: {(error as Error).message}
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Colaboradores</span>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-bold">{totals.colaboradores}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Sem nenhum ponto</span>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div className="text-3xl font-bold text-destructive">{totals.semRegistro}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Dias sem registro</span>
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div className="text-3xl font-bold">{totals.faltas}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Extras líquidas</span>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className={`text-3xl font-bold ${totals.extras >= 0 ? "text-success" : "text-destructive"}`}>{hm(totals.extras)}</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Colaborador</th>
                    <th className="text-left font-medium px-4 py-3">Com registro</th>
                    <th className="text-left font-medium px-4 py-3">Sem registro</th>
                    <th className="text-left font-medium px-4 py-3">Trabalhado</th>
                    <th className="text-left font-medium px-4 py-3">Extras brutas</th>
                    <th className="text-left font-medium px-4 py-3">Atrasos</th>
                    <th className="text-left font-medium px-4 py-3">Extras líquidas</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhum colaborador no período selecionado.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <React.Fragment key={r.name}>
                      <tr className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {r.name}
                          {r.cargo && <span className="block text-xs text-muted-foreground">{r.cargo}</span>}
                        </td>
                        <td className="px-4 py-3">{r.daysWorked}</td>
                        <td className="px-4 py-3">
                          {r.missingDates.length > 0 ? (
                            <Badge variant="outline" className="text-destructive font-normal">
                              {r.missingDates.length} dia(s)
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{hm(r.workedMinutes)}</td>
                        <td className="px-4 py-3 text-success">{hm(r.overtimeMinutes)}</td>
                        <td className="px-4 py-3 text-destructive">{hm(r.deficitMinutes)}</td>
                        <td className={`px-4 py-3 font-semibold ${r.netMinutes >= 0 ? "text-success" : "text-destructive"}`}>
                          {hm(r.netMinutes)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setExpanded((prev) => (prev.includes(r.name) ? prev.filter((n) => n !== r.name) : [...prev, r.name]))
                            }
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${expanded.includes(r.name) ? "rotate-180" : ""}`} />
                          </Button>
                        </td>
                      </tr>
                      {expanded.includes(r.name) && (
                        <tr className="border-t border-border/40 bg-muted/20">
                          <td colSpan={8} className="px-4 py-3">
                            {r.missingDates.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Registrou ponto em todos os dias do período.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {r.missingDates.map((d) => (
                                  <Badge key={d} variant="outline" className="font-normal text-destructive">
                                    {brDate(d)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
