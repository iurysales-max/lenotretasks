import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, ListTodo, Calendar as CalIcon, TrendingUp, Loader2 } from "lucide-react";
import { format, isToday, isPast, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchStatuses, PRIORITY_META, type Task } from "@/lib/workspace-data";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: DashboardPage,
});

function DashboardPage() {
  const { profile } = useAuth();

  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const doneIds = statuses.filter((s) => s.is_done).map((s) => s.id);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("archived", false).order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as Task[];
    },
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status_id && doneIds.includes(t.status_id)).length;
  const pending = tasks.filter((t) => !t.status_id || (!doneIds.includes(t.status_id!) && t.status_id === statuses[0]?.id)).length;
  const inProgress = tasks.filter((t) => t.status_id === statuses[1]?.id).length;
  const overdue = tasks.filter((t) => t.due_date && isPast(endOfDay(parseISO(t.due_date))) && !(t.status_id && doneIds.includes(t.status_id))).length;
  const todayTasks = tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)));

  const { data: events = [] } = useQuery({
    queryKey: ["today-events"],
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end = endOfDay(new Date()).toISOString();
      const { data } = await supabase.from("calendar_events").select("*").gte("start_at", start).lte("start_at", end).order("start_at");
      return data ?? [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,title,updated_at,status_id").order("updated_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Total", value: total, icon: ListTodo, color: "text-info" },
    { label: "Pendentes", value: pending, icon: Clock, color: "text-muted-foreground" },
    { label: "Em andamento", value: inProgress, icon: Loader2, color: "text-info" },
    { label: "Concluídas", value: done, icon: CheckCircle2, color: "text-success" },
    { label: "Atrasadas", value: overdue, icon: AlertCircle, color: "text-destructive" },
    { label: "Hoje", value: todayTasks.length, icon: CalIcon, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {profile?.name?.split(" ")[0] || "colaborador"} 👋</h1>
        <p className="text-muted-foreground mt-1">Aqui está o resumo de hoje, {format(new Date(), "d 'de' MMMM", { locale: ptBR })}.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 hover:shadow-elegant transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-2xl font-bold">{isLoading ? "…" : c.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Tarefas de hoje</h2>
            <Link to="/tarefas" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </div>
          <div className="space-y-2">
            {todayTasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa para hoje 🎉</p>}
            {todayTasks.map((t) => {
              const status = statuses.find((s) => s.id === t.status_id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/60 transition-colors">
                  <div className="w-2 h-2 rounded-full" style={{ background: status?.color ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    {status && <div className="text-xs text-muted-foreground">{status.name}</div>}
                  </div>
                  <Badge variant="outline" style={{ borderColor: PRIORITY_META[t.priority].color, color: PRIORITY_META[t.priority].color }}>
                    {PRIORITY_META[t.priority].label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-lg mb-4">Próximos compromissos</h2>
          <div className="space-y-3">
            {events.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos hoje.</p>}
            {events.map((e: { id: string; title: string; start_at: string; color: string }) => (
              <div key={e.id} className="flex gap-3">
                <div className="w-1 rounded-full self-stretch" style={{ background: e.color }} />
                <div>
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{format(parseISO(e.start_at), "HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-lg">Últimas atividades</h2>
        </div>
        <div className="space-y-2">
          {activities.map((a: { id: string; title: string; updated_at: string; status_id: string | null }) => {
            const s = statuses.find((x) => x.id === a.status_id);
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-2 h-2 rounded-full" style={{ background: s?.color ?? "#94a3b8" }} />
                <div className="flex-1 text-sm">{a.title}</div>
                <div className="text-xs text-muted-foreground">{format(parseISO(a.updated_at), "d MMM HH:mm", { locale: ptBR })}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
