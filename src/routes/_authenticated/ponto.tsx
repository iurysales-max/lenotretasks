import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, LogIn, LogOut, Coffee, Users, AlertTriangle, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

interface Employee {
  id: string;
  name: string;
  email: string | null;
  pin: string | null;
  tangerino_id: string | null;
  cargo: string | null;
  active: boolean;
}

interface Row {
  key: string;
  name: string;
  email: string | null;
  pin: string | null;
  cargo: string | null;
  cadastrado: boolean;
  punch: EmployeeDay | null;
}

const todayISO = () => {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
};

const minutes = (m: number) => (m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : "—");

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function PontoPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO);
  const [q, setQ] = useState("");
  const [onlyRegistered, setOnlyRegistered] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", pin: "", cargo: "" });
  const fetchPunch = useServerFn(getPunchDay);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["punch-day", date],
    queryFn: () => fetchPunch({ data: { date } }),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("employees").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        pin: form.pin.trim() || null,
        cargo: form.cargo.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funcionário adicionado");
      setForm({ name: "", email: "", pin: "", cargo: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo<Row[]>(() => {
    const punches: EmployeeDay[] = data?.employees ?? [];
    const byName = new Map(punches.map((p) => [norm(p.name), p]));
    const used = new Set<string>();

    const list: Row[] = employees
      .filter((e) => e.active)
      .map((e) => {
        const match =
          byName.get(norm(e.name)) ??
          (e.pin ? punches.find((p) => p.pin === e.pin) : undefined) ??
          null;
        if (match) used.add(norm(match.name));
        return {
          key: e.id,
          name: e.name,
          email: e.email ?? match?.email ?? null,
          pin: e.pin ?? match?.pin ?? null,
          cargo: e.cargo,
          cadastrado: true,
          punch: match,
        };
      });

    for (const p of punches) {
      if (used.has(norm(p.name))) continue;
      list.push({
        key: `t-${p.employeeId}`,
        name: p.name,
        email: p.email,
        pin: p.pin,
        cargo: null,
        cadastrado: false,
        punch: p,
      });
    }

    const term = q.trim().toLowerCase();
    return list
      .filter((r) => (onlyRegistered ? !!r.punch : true))
      .filter((r) => (!term ? true : [r.name, r.email, r.pin].some((v) => (v ?? "").toLowerCase().includes(term))))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data, employees, q, onlyRegistered]);

  const totals = useMemo(() => {
    const punches = data?.employees ?? [];
    return {
      cadastrados: employees.filter((e) => e.active).length,
      registraram: punches.length,
      comIntervalo: punches.filter((e) => e.intervalos.length > 0).length,
      pendentes: punches.filter((e) => e.pendente).length,
      horas: punches.reduce((s, e) => s + e.workedMinutes, 0),
    };
  }, [data, employees]);

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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4 mr-2" />Novo funcionário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>PIN do ponto</Label><Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
                  <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Cadastrados</span><Users className="w-4 h-4 text-primary" /></div>
          <div className="text-3xl font-bold">{totals.cadastrados}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Registraram</span><LogIn className="w-4 h-4 text-success" /></div>
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

      <div className="flex items-center gap-2">
        <Switch checked={onlyRegistered} onCheckedChange={setOnlyRegistered} id="only-reg" />
        <Label htmlFor="only-reg" className="text-sm text-muted-foreground">Mostrar apenas quem registrou ponto</Label>
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
              {isFetching && !data && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Carregando registros…</td></tr>
              )}
              {rows.length === 0 && !isFetching && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum funcionário encontrado.</td></tr>
              )}
              {rows.map((r) => {
                const e = r.punch;
                return (
                  <tr key={r.key} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-2">
                        {r.name}
                        {!r.cadastrado && <Badge variant="secondary" className="font-normal text-[10px]">fora do cadastro</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.email ?? r.cargo ?? "—"}{r.pin ? ` · PIN ${r.pin}` : ""}
                      </div>
                    </td>
                    {!e ? (
                      <td colSpan={5} className="px-4 py-3 text-muted-foreground">Sem registro neste dia</td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5 text-success" />{e.entrada ?? "—"}</span>
                          {e.localEntrada && <div className="text-[11px] text-muted-foreground max-w-[180px] truncate" title={e.localEntrada}>{e.localEntrada}</div>}

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
                          {e.localSaida && <div className="text-[11px] text-muted-foreground max-w-[180px] truncate" title={e.localSaida}>{e.localSaida}</div>}

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
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
