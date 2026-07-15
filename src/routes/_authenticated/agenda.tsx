import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, Clock } from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agenda")({
  ssr: false,
  component: AgendaPage,
});

interface Ev { id: string; title: string; description: string | null; start_at: string; end_at: string; all_day: boolean; color: string; created_by: string; }

type Draft = {
  title: string; description: string; date: string; start: string; end: string; all_day: boolean; color: string;
};

const emptyDraft = (dateStr?: string): Draft => ({
  title: "", description: "",
  date: dateStr ?? format(new Date(), "yyyy-MM-dd"),
  start: "09:00", end: "10:00", all_day: false, color: "#22c55e",
});

function AgendaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = new Date(d.getTime() + 86400000)) days.push(new Date(d));

  const { data: events = [] } = useQuery({
    queryKey: ["events", cursor.getMonth(), cursor.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase.from("calendar_events").select("*").gte("start_at", gridStart.toISOString()).lte("start_at", gridEnd.toISOString()).order("start_at");
      return (data ?? []) as Ev[];
    },
  });

  const [editing, setEditing] = useState<{ open: boolean; id: string | null; draft: Draft }>({ open: false, id: null, draft: emptyDraft() });
  const [dayView, setDayView] = useState<Date | null>(null);

  const openNew = (dateStr?: string) => setEditing({ open: true, id: null, draft: emptyDraft(dateStr) });
  const openEdit = (e: Ev) => {
    const start = parseISO(e.start_at);
    const end = parseISO(e.end_at);
    setEditing({
      open: true, id: e.id,
      draft: {
        title: e.title, description: e.description ?? "",
        date: format(start, "yyyy-MM-dd"),
        start: format(start, "HH:mm"), end: format(end, "HH:mm"),
        all_day: e.all_day, color: e.color,
      },
    });
  };

  const saveEvent = async () => {
    const d = editing.draft;
    if (!d.title.trim()) { toast.error("Informe um título"); return; }
    const startAt = d.all_day ? `${d.date}T00:00:00` : `${d.date}T${d.start}:00`;
    const endAt = d.all_day ? `${d.date}T23:59:59` : `${d.date}T${d.end}:00`;
    const payload = {
      title: d.title, description: d.description || null,
      start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString(),
      all_day: d.all_day, color: d.color,
    };
    if (editing.id) {
      const { error } = await supabase.from("calendar_events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Evento atualizado");
    } else {
      const { error } = await supabase.from("calendar_events").insert({ ...payload, created_by: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Evento criado");
    }
    setEditing({ open: false, id: null, draft: emptyDraft() });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Excluir este evento?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento excluído");
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const dayEvents = (d: Date) => events.filter((e) => isSameDay(parseISO(e.start_at), d)).sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm">Calendário compartilhado do workspace</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="font-semibold px-3 min-w-[160px] text-center capitalize">{format(cursor, "MMMM yyyy", { locale: ptBR })}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button onClick={() => openNew()}><Plus className="w-4 h-4 mr-1" />Novo evento</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
            <div key={d} className="p-2 text-xs font-semibold uppercase text-center text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const de = dayEvents(d);
            const isCurrent = isSameMonth(d, cursor);
            const isTod = isSameDay(d, new Date());
            return (
              <button
                type="button"
                key={d.toISOString()}
                onClick={() => setDayView(d)}
                className={"min-h-24 border-r border-b p-1.5 text-left hover:bg-accent/40 transition-colors " + (isCurrent ? "" : "bg-muted/30 text-muted-foreground")}
              >
                <div className={"text-xs font-medium mb-1 " + (isTod ? "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center" : "")}>
                  {format(d, "d")}
                </div>
                <div className="space-y-1">
                  {de.slice(0, 3).map((e) => (
                    <div key={e.id} className="text-[10px] truncate px-1.5 py-0.5 rounded" style={{ background: e.color + "25", color: e.color }}>
                      {e.all_day ? "" : format(parseISO(e.start_at), "HH:mm ")}{e.title}
                    </div>
                  ))}
                  {de.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{de.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Day view */}
      <Dialog open={!!dayView} onOpenChange={(o) => !o && setDayView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayView && format(dayView, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription>Eventos deste dia</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {dayView && dayEvents(dayView).length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Nenhum evento neste dia.</div>
            )}
            {dayView && dayEvents(dayView).map((e) => (
              <div key={e.id} className="flex items-start gap-2 p-2.5 rounded-lg border" style={{ borderLeftWidth: 4, borderLeftColor: e.color }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {e.all_day ? "Dia inteiro" : `${format(parseISO(e.start_at), "HH:mm")} – ${format(parseISO(e.end_at), "HH:mm")}`}
                  </div>
                  {e.description && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.description}</div>}
                </div>
                {e.created_by === user?.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { setDayView(null); openEdit(e); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteEvent(e.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-3 border-t">
            <Button onClick={() => { const ds = dayView ? format(dayView, "yyyy-MM-dd") : undefined; setDayView(null); openNew(ds); }}>
              <Plus className="w-4 h-4 mr-1" />Novo evento neste dia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit */}
      <Dialog open={editing.open} onOpenChange={(o) => setEditing({ ...editing, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>Preencha os campos do evento</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editing.draft.title} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={editing.draft.description} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value } })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing.draft.all_day} onCheckedChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, all_day: v } })} /><Label>Dia inteiro</Label></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Data</Label><Input type="date" value={editing.draft.date} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, date: e.target.value } })} /></div>
              {!editing.draft.all_day && <>
                <div><Label>Início</Label><Input type="time" value={editing.draft.start} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, start: e.target.value } })} /></div>
                <div><Label>Fim</Label><Input type="time" value={editing.draft.end} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, end: e.target.value } })} /></div>
              </>}
            </div>
            <div><Label>Cor</Label><Input type="color" value={editing.draft.color} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, color: e.target.value } })} className="h-10 w-24" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setEditing({ open: false, id: null, draft: emptyDraft() })}>Cancelar</Button>
            <Button onClick={saveEvent}>{editing.id ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
