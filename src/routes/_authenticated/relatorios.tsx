import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchStatuses, type Task } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { isPast, endOfDay, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/relatorios")({
  ssr: false,
  component: RelatoriosPage,
});

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function RelatoriosPage() {
  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data as Task[] ?? [],
  });
  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors"],
    queryFn: async () => (await supabase.from("sectors").select("id,name")).data ?? [],
  });
  const { data: assigneeAgg = [] } = useQuery({
    queryKey: ["assignee-agg"],
    queryFn: async () => {
      const [{ data: ta }, { data: pf }] = await Promise.all([
        supabase.from("task_assignees").select("user_id"),
        supabase.from("profiles").select("id,name"),
      ]);
      const counts: Record<string, number> = {};
      (ta ?? []).forEach((r: { user_id: string }) => counts[r.user_id] = (counts[r.user_id] ?? 0) + 1);
      return (pf ?? []).map((p: { id: string; name: string }) => ({ name: p.name || "?", value: counts[p.id] ?? 0 })).filter(x => x.value > 0);
    },
  });

  const doneIds = statuses.filter((s) => s.is_done).map((s) => s.id);
  const statusData = statuses.map((s) => ({ name: s.name, value: tasks.filter((t) => t.status_id === s.id).length, color: s.color }));
  const sectorData = sectors.map((s: { id: string; name: string }) => ({ name: s.name, value: tasks.filter((t) => t.sector_id === s.id).length }));

  const totals = {
    total: tasks.length,
    done: tasks.filter((t) => t.status_id && doneIds.includes(t.status_id)).length,
    overdue: tasks.filter((t) => t.due_date && isPast(endOfDay(parseISO(t.due_date))) && !(t.status_id && doneIds.includes(t.status_id))).length,
  };
  const productivity = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Métricas e produtividade</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</div><div className="text-3xl font-bold">{totals.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Concluídas</div><div className="text-3xl font-bold text-success">{totals.done}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Atrasadas</div><div className="text-3xl font-bold text-destructive">{totals.overdue}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Produtividade</div><div className="text-3xl font-bold text-primary">{productivity}%</div></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Tarefas por status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Tarefas por setor</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sectorData}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Tarefas por colaborador</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={assigneeAgg} layout="vertical">
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" fontSize={11} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                {assigneeAgg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
