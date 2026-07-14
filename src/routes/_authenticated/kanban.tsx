import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchStatuses, fetchProfiles, type Task, PRIORITY_META } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, UserCircle2 } from "lucide-react";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kanban")({
  ssr: false,
  component: KanbanPage,
});

function KanbanPage() {
  const qc = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("archived", false);
      return (data ?? []) as Task[];
    },
  });
  const { data: assigneesMap = {} } = useQuery({
    queryKey: ["task-assignees-all"],
    queryFn: async () => {
      const { data } = await supabase.from("task_assignees").select("task_id,user_id");
      const m: Record<string, string[]> = {};
      (data ?? []).forEach((r: { task_id: string; user_id: string }) => {
        (m[r.task_id] ||= []).push(r.user_id);
      });
      return m;
    },
  });

  const profileById = (id: string | null | undefined) =>
    id ? profiles.find((p) => p.id === id) : undefined;
  const initialsOf = (name?: string | null, email?: string | null) =>
    (name || email || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const [dlg, setDlg] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [dragging, setDragging] = useState<string | null>(null);

  const onDrop = async (statusId: string) => {
    if (!dragging) return;
    await supabase.from("tasks").update({ status_id: statusId }).eq("id", dragging);
    setDragging(null);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kanban</h1>
          <p className="text-muted-foreground text-sm">Arraste os cartões entre as colunas</p>
        </div>
        <Button onClick={() => setDlg({ open: true, id: null })}><Plus className="w-4 h-4 mr-1" />Nova tarefa</Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((s) => {
          const col = tasks.filter((t) => t.status_id === s.id);
          return (
            <div
              key={s.id}
              className="w-72 shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.id)}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">{col.length}</div>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/40 rounded-lg p-2">
                {col.map((t) => {
                  const creator = profileById(t.created_by);
                  const assigneeIds = assigneesMap[t.id] ?? [];
                  const assigneeProfiles = assigneeIds
                    .map((id) => profileById(id))
                    .filter((p): p is NonNullable<typeof p> => Boolean(p));
                  return (
                    <Card
                      key={t.id}
                      draggable
                      onDragStart={() => setDragging(t.id)}
                      onClick={() => setDlg({ open: true, id: t.id })}
                      className="p-3 cursor-pointer hover:shadow-elegant hover:-translate-y-0.5 transition-all"
                    >
                      <div className="text-sm font-medium mb-2">{t.title}</div>

                      {/* Criador */}
                      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-wide">Criado por</span>
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={creator?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-muted">
                            {initialsOf(creator?.name, creator?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[140px] text-foreground/80">
                          {creator?.name || creator?.email || "—"}
                        </span>
                      </div>

                      {/* Responsáveis */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Para</span>
                        {assigneeProfiles.length === 0 ? (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <UserCircle2 className="w-3.5 h-3.5" /> Sem responsável
                          </span>
                        ) : (
                          <div className="flex -space-x-1.5">
                            {assigneeProfiles.slice(0, 4).map((p) => (
                              <Avatar key={p.id} className="w-5 h-5 ring-2 ring-background" title={p.name || p.email}>
                                <AvatarImage src={p.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
                                  {initialsOf(p.name, p.email)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {assigneeProfiles.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-muted text-[9px] flex items-center justify-center ring-2 ring-background">
                                +{assigneeProfiles.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: PRIORITY_META[t.priority].color, color: PRIORITY_META[t.priority].color }}>
                          {PRIORITY_META[t.priority].label}
                        </Badge>
                        {t.due_date && <span className="text-[10px] text-muted-foreground">{new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        taskId={dlg.id}
        open={dlg.open}
        onOpenChange={(o) => {
          setDlg({ open: o, id: o ? dlg.id : null });
          if (!o) qc.invalidateQueries({ queryKey: ["task-assignees-all"] });
        }}
      />
    </div>
  );
}
