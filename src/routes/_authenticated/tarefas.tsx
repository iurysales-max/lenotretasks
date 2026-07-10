import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchProfiles, fetchSectors, fetchStatuses, PRIORITY_META, type Task, type Priority } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, Filter, Pin, Star, LayoutList, KanbanSquare } from "lucide-react";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { format, parseISO, isPast, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tarefas")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ open: (s.open as string) || undefined }),
  component: TarefasPage,
});

function TarefasPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();

  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const { data: sectors = [] } = useQuery({ queryKey: ["sectors"], queryFn: fetchSectors });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("archived", false).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return (data ?? []) as Task[];
    },
  });

  const { data: assigneeMap = {} } = useQuery({
    queryKey: ["all-assignees"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignees").select("task_id,user_id");
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r: { task_id: string; user_id: string }) => { (map[r.task_id] ||= []).push(r.user_id); });
      return map;
    },
  });

  const [q, setQ] = useState("");
  const [fSector, setFSector] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fPriority, setFPriority] = useState<string>("all");
  const [fCategory, setFCategory] = useState<string>("all");

  const [dlg, setDlg] = useState<{ open: boolean; id: string | null }>({ open: !!search.open, id: search.open ?? null });

  const filtered = useMemo(() => tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (fSector !== "all" && t.sector_id !== fSector) return false;
    if (fStatus !== "all" && t.status_id !== fStatus) return false;
    if (fPriority !== "all" && t.priority !== fPriority) return false;
    if (fCategory !== "all" && t.category_id !== fCategory) return false;
    return true;
  }), [tasks, q, fSector, fStatus, fPriority, fCategory]);

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("tasks").update({ pinned: !pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-muted-foreground text-sm">Gerencie todas as tarefas do workspace</p>
        </div>
        <div className="flex gap-2">
          <Link to="/kanban"><Button variant="outline" size="sm"><KanbanSquare className="w-4 h-4 mr-1" />Kanban</Button></Link>
          <Button variant="outline" size="sm"><LayoutList className="w-4 h-4 mr-1" />Lista</Button>
          <Button onClick={() => setDlg({ open: true, id: null })}><Plus className="w-4 h-4 mr-1" />Nova tarefa</Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarefas..." className="pl-9" />
          </div>
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos status</SelectItem>{statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Select value={fSector} onValueChange={setFSector}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos setores</SelectItem>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Select value={fCategory} onValueChange={setFCategory}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={fPriority} onValueChange={setFPriority}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{(Object.keys(PRIORITY_META) as Priority[]).map(p => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}</SelectContent></Select>
        </div>
      </Card>

      <Card className="divide-y">
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">Nenhuma tarefa encontrada.</div>}
        {filtered.map((t) => {
          const s = statuses.find(x => x.id === t.status_id);
          const cat = categories.find(x => x.id === t.category_id);
          const sec = sectors.find(x => x.id === t.sector_id);
          const overdue = t.due_date && isPast(endOfDay(parseISO(t.due_date))) && !s?.is_done;
          const uids = assigneeMap[t.id] ?? [];
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => setDlg({ open: true, id: t.id })}>
              <button onClick={(e) => { e.stopPropagation(); togglePin(t.id, t.pinned); }} className="text-muted-foreground hover:text-primary">
                {t.pinned ? <Pin className="w-4 h-4 fill-current text-primary" /> : <Pin className="w-4 h-4" />}
              </button>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s?.color ?? "#94a3b8" }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.title}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {s && <span className="text-xs text-muted-foreground">{s.name}</span>}
                  {sec && <Badge variant="secondary" className="text-[10px]" style={{ background: sec.color + "20", color: sec.color }}>{sec.name}</Badge>}
                  {cat && <Badge variant="outline" className="text-[10px]">{cat.name}</Badge>}
                  {t.due_date && (
                    <span className={"text-xs " + (overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {format(parseISO(t.due_date), "d MMM", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" style={{ borderColor: PRIORITY_META[t.priority].color, color: PRIORITY_META[t.priority].color }} className="shrink-0">
                {PRIORITY_META[t.priority].label}
              </Badge>
              <div className="flex -space-x-2 shrink-0">
                {uids.slice(0, 3).map((uid) => {
                  const p = profiles.find(x => x.id === uid);
                  return <Avatar key={uid} className="w-7 h-7 border-2 border-background"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{p?.name?.[0] ?? "?"}</AvatarFallback></Avatar>;
                })}
                {uids.length > 3 && <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">+{uids.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </Card>

      <TaskDialog taskId={dlg.id} open={dlg.open} onOpenChange={(o) => setDlg({ open: o, id: o ? dlg.id : null })} />
    </div>
  );
}
