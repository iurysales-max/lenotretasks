import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Clock, Search, TrendingUp, TrendingDown, Users } from "lucide-react";
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

export function OvertimePanel({ employeeNames, today }: { employeeNames: string[]; today: string }) {
  const [start, setStart] = useState(() => shiftDays(today, -13));
  const [end, setEnd] = useState(today);
  const [dailyHours, setDailyHours] = useState("8.48");
  const [selected, setSelected] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [range, setRange] = useState<{ start: string; end: string; dailyMinutes: number } | null>(null);
  const fetchOvertime = useServerFn(getOvertimePeriod);

  const dailyMinutes = Math.round((Number(dailyHours.replace(",", ".")) || 8.48) * 60);

  const { data, isFetching, error } = useQuery({
    queryKey: ["overtime", range?.start, range?.end, range?.dailyMinutes],
    queryFn: () => fetchOvertime({ data: range! }),
    enabled: !!range,
    staleTime: 5 * 60_000,
  });

  const selectedSet = useMemo(() => new Set(selected.map(norm)), [selected]);

  const rows = useMemo(() => {
    const list = data?.employees ?? [];
    return selectedSet.size === 0 ? list : list.filter((e) => selectedSet.has(norm(e.name)));
  }, [data, selectedSet]);

  const totals = useMemo(
    () => ({
      colaboradores: rows.length,
      extras: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
      deficit: rows.reduce((s, r) => s + r.deficitMinutes, 0),
      trabalhado: rows.reduce((s, r) => s + r.workedMinutes, 0),
    }),
    [rows],
  );

  const filteredNames = useMemo(() => {
    const t = norm(pick);
    return employeeNames.filter((n) => (!t ? true : norm(n).includes(t))).slice(0, 200);
  }, [employeeNames, pick]);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  return (
    <div className="space-y-6">
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
                <Button variant="outline" className="w-[240px] justify-between font-normal">
                  {selected.length === 0 ? "Todos" : `${selected.length} selecionado(s)`}
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2" align="start">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
                </div>
                <ScrollArea className="h-[260px] pr-2">
                  <div className="space-y-1">
                    {filteredNames.map((n) => (
                      <label key={n} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
                        <Checkbox checked={selected.includes(n)} onCheckedChange={() => toggle(n)} />
                        <span className="truncate">{n}</span>
                      </label>
                    ))}
                    {filteredNames.length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-4">Nenhum colaborador.</p>
                    )}
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
          <Button onClick={() => setRange({ start, end, dailyMinutes })} disabled={isFetching}>
            <Clock className="w-4 h-4 mr-2" />
            {isFetching ? "Calculando…" : "Calcular horas extras"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Só dias com registro de ponto entram no cálculo. Período máximo de 62 dias por consulta.
        </p>
      </Card>

      {error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Não foi possível calcular: {(error as Error).message}
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
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Horas extras</span>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className="text-3xl font-bold text-success">{hm(totals.extras)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Horas a menos</span>
                <TrendingDown className="w-4 h-4 text-destructive" />
              </div>
              <div className="text-3xl font-bold text-destructive">{hm(totals.deficit)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Trabalhado</span>
                <Clock className="w-4 h-4 text-info" />
              </div>
              <div className="text-3xl font-bold">{hm(totals.trabalhado)}</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Colaborador</th>
                    <th className="text-left font-medium px-4 py-3">Dias</th>
                    <th className="text-left font-medium px-4 py-3">Previsto</th>
                    <th className="text-left font-medium px-4 py-3">Trabalhado</th>
                    <th className="text-left font-medium px-4 py-3">Extras</th>
                    <th className="text-left font-medium px-4 py-3">A menos</th>
                    <th className="text-left font-medium px-4 py-3">Saldo</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhum registro no período selecionado.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => {
                    const saldo = r.overtimeMinutes - r.deficitMinutes;
                    return (
                      <Collapsible key={r.name} asChild>
                        <>
                          <tr className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                            <td className="px-4 py-3 font-medium">{r.name}</td>
                            <td className="px-4 py-3">{r.daysWorked}</td>
                            <td className="px-4 py-3 text-muted-foreground">{hm(r.expectedMinutes)}</td>
                            <td className="px-4 py-3">{hm(r.workedMinutes)}</td>
                            <td className="px-4 py-3 text-success font-medium">{hm(r.overtimeMinutes)}</td>
                            <td className="px-4 py-3 text-destructive">{hm(r.deficitMinutes)}</td>
                            <td className={`px-4 py-3 font-semibold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
                              {hm(saldo)}
                            </td>
                            <td className="px-4 py-3">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </CollapsibleTrigger>
                            </td>
                          </tr>
                          <CollapsibleContent asChild>
                            <tr className="border-t border-border/40 bg-muted/20">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {r.days.map((d) => {
                                    const diff = d.workedMinutes > 0 ? d.workedMinutes - (data.dailyExpectedMinutes ?? 0) : 0;
                                    return (
                                      <div key={d.date} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs">
                                        <span className="font-medium">{brDate(d.date)}</span>
                                        <span className="text-muted-foreground">
                                          {d.entrada ?? "—"} – {d.saida ?? "—"}
                                        </span>
                                        <span>{hm(d.workedMinutes)}</span>
                                        {d.workedMinutes > 0 && (
                                          <Badge variant="outline" className={`font-normal ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                                            {hm(diff)}
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
