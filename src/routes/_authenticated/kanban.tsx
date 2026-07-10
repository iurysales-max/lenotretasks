import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchStatuses, type Task, PRIORITY_META } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kanban")({
  ssr: false,
  component: KanbanPage,
});

function KanbanPage() {
  const qc = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("archived", false);
      return (data ?? []) as Task[];
    },
  });

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
                {col.map((t) => (
                  <Card
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onClick={() => setDlg({ open: true, id: t.id })}
                    className="p-3 cursor-pointer hover:shadow-elegant hover:-translate-y-0.5 transition-all"
                  >
                    <div className="text-sm font-medium mb-2">{t.title}</div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: PRIORITY_META[t.priority].color, color: PRIORITY_META[t.priority].color }}>
                        {PRIORITY_META[t.priority].label}
                      </Badge>
                      {t.due_date && <span className="text-[10px] text-muted-foreground">{new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog taskId={dlg.id} open={dlg.open} onOpenChange={(o) => setDlg({ open: o, id: o ? dlg.id : null })} />
    </div>
  );
}
