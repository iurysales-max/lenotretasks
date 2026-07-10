import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Paperclip, ListChecks, Star, Copy, Archive, Trash2, Plus, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchCategories, fetchProfiles, fetchSectors, fetchStatuses, PRIORITY_META, type Priority, type Task } from "@/lib/workspace-data";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function TaskDialog({ taskId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: sectors = [] } = useQuery({ queryKey: ["sectors"], queryFn: fetchSectors });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const isNew = !taskId;

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      return data as Task | null;
    },
    enabled: !!taskId && open,
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    },
    enabled: !!taskId && open,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data } = await supabase.from("task_comments").select("id,user_id,content,created_at").eq("task_id", taskId).order("created_at");
      return data ?? [];
    },
    enabled: !!taskId && open,
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data: cl } = await supabase.from("task_checklists").select("id").eq("task_id", taskId).limit(1).maybeSingle();
      if (!cl) return [];
      const { data } = await supabase.from("checklist_items").select("*").eq("checklist_id", cl.id).order("position");
      return (data ?? []).map((i) => ({ ...i, checklist_id: cl.id }));
    },
    enabled: !!taskId && open,
  });

  const [draft, setDraft] = useState<Partial<Task>>({});
  const [newComment, setNewComment] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const current = { ...(task ?? {}), ...draft } as Partial<Task>;

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<Task> & { assignees?: string[] }) => {
      const { assignees: assignedUsers, ...rest } = payload;
      if (isNew) {
        const { data, error } = await supabase.from("tasks").insert({
          title: rest.title || "Nova tarefa",
          description: rest.description ?? null,
          sector_id: rest.sector_id ?? null,
          category_id: rest.category_id ?? null,
          status_id: rest.status_id ?? statuses[0]?.id ?? null,
          priority: (rest.priority as Priority) ?? "normal",
          due_date: rest.due_date ?? null,
          due_time: rest.due_time ?? null,
          estimated_minutes: rest.estimated_minutes ?? null,
          created_by: user!.id,
        }).select().single();
        if (error) throw error;
        if (assignedUsers?.length) {
          await supabase.from("task_assignees").insert(assignedUsers.map((uid) => ({ task_id: data.id, user_id: uid })));
          await supabase.from("notifications").insert(assignedUsers.filter(uid => uid !== user!.id).map((uid) => ({
            user_id: uid, title: "Nova tarefa atribuída", message: rest.title || "Nova tarefa", type: "task",
          })));
        }
        return data;
      } else {
        const { error } = await supabase.from("tasks").update(rest).eq("id", taskId!);
        if (error) throw error;
        return task;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Tarefa criada" : "Tarefa atualizada");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      onOpenChange(false);
      setDraft({});
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!taskId || !newComment.trim()) return;
      await supabase.from("task_comments").insert({ task_id: taskId, user_id: user!.id, content: newComment.trim() });
    },
    onSuccess: () => { setNewComment(""); qc.invalidateQueries({ queryKey: ["task-comments", taskId] }); },
  });

  const addChecklistItem = useMutation({
    mutationFn: async () => {
      if (!taskId || !newChecklistItem.trim()) return;
      let clId = checklist[0]?.checklist_id;
      if (!clId) {
        const { data } = await supabase.from("task_checklists").insert({ task_id: taskId }).select().single();
        clId = data!.id;
      }
      await supabase.from("checklist_items").insert({ checklist_id: clId, text: newChecklistItem.trim(), position: checklist.length });
    },
    onSuccess: () => { setNewChecklistItem(""); qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }); },
  });

  const toggleItem = async (id: string, done: boolean) => {
    await supabase.from("checklist_items").update({ done }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  };

  const duplicateTask = async () => {
    if (!task) return;
    const { data } = await supabase.from("tasks").insert({
      title: task.title + " (cópia)", description: task.description, sector_id: task.sector_id,
      category_id: task.category_id, status_id: task.status_id, priority: task.priority, created_by: user!.id,
    }).select().single();
    if (data) { toast.success("Tarefa duplicada"); qc.invalidateQueries({ queryKey: ["tasks"] }); }
  };

  const archiveTask = async () => {
    if (!taskId) return;
    await supabase.from("tasks").update({ archived: true }).eq("id", taskId);
    toast.success("Tarefa arquivada");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onOpenChange(false);
  };

  const deleteTask = async () => {
    if (!taskId || !confirm("Excluir esta tarefa?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    toast.success("Tarefa excluída");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onOpenChange(false);
  };

  const toggleFav = async () => {
    if (!taskId || !user) return;
    const { data } = await supabase.from("task_favorites").select("task_id").eq("task_id", taskId).eq("user_id", user.id).maybeSingle();
    if (data) await supabase.from("task_favorites").delete().eq("task_id", taskId).eq("user_id", user.id);
    else await supabase.from("task_favorites").insert({ task_id: taskId, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const [localAssignees, setLocalAssignees] = useState<string[]>([]);
  const effectiveAssignees = isNew ? localAssignees : assignees;

  const toggleAssignee = async (uid: string) => {
    if (isNew) {
      setLocalAssignees((p) => p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]);
      return;
    }
    if (assignees.includes(uid)) {
      await supabase.from("task_assignees").delete().eq("task_id", taskId!).eq("user_id", uid);
    } else {
      await supabase.from("task_assignees").insert({ task_id: taskId!, user_id: uid });
      await supabase.from("notifications").insert({ user_id: uid, title: "Você foi atribuído a uma tarefa", message: task?.title, type: "task" });
    }
    qc.invalidateQueries({ queryKey: ["task-assignees", taskId] });
  };

  const doneItems = checklist.filter((c) => c.done).length;
  const progress = checklist.length ? Math.round((doneItems / checklist.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setDraft({}); setLocalAssignees([]); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova tarefa" : "Editar tarefa"}</DialogTitle>
          <DialogDescription>Preencha os campos abaixo. Os campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={current.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="text-lg font-semibold mt-1" placeholder="Ex: Aprovar orçamento do projeto" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={current.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} className="mt-1" />
            </div>

            {!isNew && (
              <Tabs defaultValue="comments">
                <TabsList>
                  <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-1" />Comentários</TabsTrigger>
                  <TabsTrigger value="checklist"><ListChecks className="w-4 h-4 mr-1" />Checklist</TabsTrigger>
                  <TabsTrigger value="attachments"><Paperclip className="w-4 h-4 mr-1" />Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="space-y-3 mt-3">
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {comments.map((c: { id: string; user_id: string; content: string; created_at: string }) => {
                      const p = profiles.find((x) => x.id === c.user_id);
                      return (
                        <div key={c.id} className="flex gap-2">
                          <Avatar className="w-8 h-8"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{(p?.name ?? "?")[0]}</AvatarFallback></Avatar>
                          <div className="flex-1 bg-accent/50 rounded-lg p-2 text-sm">
                            <div className="flex gap-2 items-baseline">
                              <span className="font-medium">{p?.name}</span>
                              <span className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "d MMM HH:mm", { locale: ptBR })}</span>
                            </div>
                            <div>{c.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário..." onKeyDown={(e) => e.key === "Enter" && addComment.mutate()} />
                    <Button onClick={() => addComment.mutate()} size="icon"><Send className="w-4 h-4" /></Button>
                  </div>
                </TabsContent>
                <TabsContent value="checklist" className="space-y-3 mt-3">
                  {checklist.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-sm text-muted-foreground">{doneItems}/{checklist.length}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {checklist.map((i) => (
                      <div key={i.id} className="flex items-center gap-2">
                        <Checkbox checked={i.done} onCheckedChange={(v) => toggleItem(i.id, !!v)} />
                        <span className={"text-sm " + (i.done ? "line-through text-muted-foreground" : "")}>{i.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder="Adicionar item..." onKeyDown={(e) => e.key === "Enter" && addChecklistItem.mutate()} />
                    <Button onClick={() => addChecklistItem.mutate()} size="icon"><Plus className="w-4 h-4" /></Button>
                  </div>
                </TabsContent>
                <TabsContent value="attachments" className="mt-3">
                  <p className="text-sm text-muted-foreground">Upload de arquivos: PDF, Excel, imagens e mais. Conecte um bucket para ativar.</p>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={current.status_id ?? undefined} onValueChange={(v) => setDraft({ ...draft, status_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s.id} value={s.id}><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: s.color }} />{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={current.priority ?? "normal"} onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRIORITY_META) as Priority[]).map((p) => <SelectItem key={p} value={p}><Badge variant="outline" style={{ borderColor: PRIORITY_META[p].color, color: PRIORITY_META[p].color }}>{PRIORITY_META[p].label}</Badge></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={current.sector_id ?? undefined} onValueChange={(v) => setDraft({ ...draft, sector_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={current.category_id ?? undefined} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={current.due_date ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={current.due_time ?? ""} onChange={(e) => setDraft({ ...draft, due_time: e.target.value || null })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tempo estimado (min)</Label>
              <Input type="number" value={current.estimated_minutes ?? ""} onChange={(e) => setDraft({ ...draft, estimated_minutes: e.target.value ? Number(e.target.value) : null })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Responsáveis</Label>
              <div className="mt-1 space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                {profiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer">
                    <Checkbox checked={effectiveAssignees.includes(p.id)} onCheckedChange={() => toggleAssignee(p.id)} />
                    <Avatar className="w-6 h-6"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{p.name[0]}</AvatarFallback></Avatar>
                    <span className="text-sm truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {!isNew && (
              <div className="flex flex-wrap gap-1 pt-2">
                <Button size="sm" variant="ghost" onClick={toggleFav}><Star className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={duplicateTask}><Copy className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={archiveTask}><Archive className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={deleteTask} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => upsertMutation.mutate({ ...draft, assignees: isNew ? localAssignees : undefined })}>
            {isNew ? "Criar tarefa" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
