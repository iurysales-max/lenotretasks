import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { getPunchDay, type EmployeeDay } from "@/lib/tangerino.functions";

export const Route = createFileRoute("/_authenticated/ponto")({
  ssr: false,
  component: PontoPage,
  head: () => ({
    meta: [
      { title: "Controle de Ponto | Le Nôtre Workspace" },
      { name: "description", content: "Veja quem registrou ponto no dia: entrada, intervalo de almoço e saída dos colaboradores." },
      { property: "og:title", content: "Controle de Ponto | Le Nôtre Workspace" },
      { property: "og:description", content: "Registros de ponto diários dos colaboradores integrados ao Le Nôtre Workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const todayISO = () => {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
};

const minutes = (m: number) => (m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : "—");

function PontoPage() {
  const [date, setDate] = useState(todayISO);
  const [q, setQ] = useState("");
  const fetchPunch = useServerFn(getPunchDay);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["punch-day", date],
    queryFn: () => fetchPunch({ data: { date } }),
    staleTime: 60_000,
  });

  const employees = useMemo(() => {
    const list: EmployeeDay[] = data?.employees ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((e) =>
      [e.name, e.email, e.pin, e.externalId].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [data, q]);

  const totals = useMemo(() => {
    const list = data?.employees ?? [];
    return {
      registraram: list.length,
      comIntervalo: list.filter((e) => e.intervalos.length > 0).length,
      pendentes: list.filter((e) => e.pendente).length,
      horas: list.reduce((s, e) => s + e.workedMinutes, 0),
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Ponto</h1>
          <p className="text-muted-foreground text-sm">Quem registrou ponto no dia — entrada, intervalo e saída</p>
        </div>
        <div className="flex items-end gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
          <Input placeholder="Buscar colaborador…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[220px]" />
          <Button variant="outline" size="icon" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Registraram</span><Users className="w-4 h-4 text-primary" /></div>
          <div className="text-3xl font-bold">{isFetching && !data ? "…" : totals.registraram}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Com intervalo</span><Coffee className="w-4 h-4 text-info" /></div>
          <div className="text-3xl font-bold">{isFetching && !data ? "…" : totals.comIntervalo}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Pendências</span><AlertTriangle className="w-4 h-4 text-destructive" /></div>
          <div className="text-3xl font-bold text-destructive">{isFetching && !data ? "…" : totals.pendentes}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Horas totais</span><Clock className="w-4 h-4 text-success" /></div>
          <div className="text-3xl font-bold">{isFetching && !data ? "…" : minutes(totals.horas)}</div>
        </Card>
      </div>

      {error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive">
          Não foi possível carregar os registros: {(error as Error).message}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Colaborador</th>
                <th className="text-left font-medium px-4 py-3">Entrada</th>
                <th className="text-left font-medium px-4 py-3">Intervalo</th>
                <th className="text-left font-medium px-4 py-3">Saída</th>
                <th className="text-left font-medium px-4 py-3">Trabalhado</th>
                <th className="text-left font-medium px-4 py-3">Marcações</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && !data && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Carregando registros…</td></tr>
              )}
              {data && employees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum registro de ponto neste dia.</td></tr>
              )}
              {employees.map((e) => (
                <tr key={e.employeeId} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.email ?? "—"}{e.pin ? ` · PIN ${e.pin}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5 text-success" />{e.entrada ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {e.intervalos.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {e.intervalos.map((i, idx) => (
                          <div key={idx} className="text-xs">
                            {i.start} – {i.end} <span className="text-muted-foreground">({minutes(i.minutes)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5 text-destructive" />{e.saida ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{minutes(e.workedMinutes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {e.pairs.map((p, idx) => (
                        <Badge key={idx} variant="outline" className="font-normal">
                          {p.in ?? "—"} → {p.out ?? "aberto"}
                        </Badge>
                      ))}
                      {e.pendente && <Badge variant="destructive" className="font-normal">pendente</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
