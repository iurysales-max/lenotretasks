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
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agenda")({
  ssr: false,
  component: AgendaPage,
});

interface Ev { id: string; title: string; description: string | null; start_at: string; end_at: string; all_day: boolean; color: string; }

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

  const [dlgOpen, setDlgOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", date: format(new Date(), "yyyy-MM-dd"), start: "09:00", end: "10:00", all_day: false, color: "#22c55e" });

  const createEvent = async () => {
    const startAt = draft.all_day ? `${draft.date}T00:00:00` : `${draft.date}T${draft.start}:00`;
    const endAt = draft.all_day ? `${draft.date}T23:59:59` : `${draft.date}T${draft.end}:00`;
    const { error } = await supabase.from("calendar_events").insert({
      title: draft.title, description: draft.description || null,
      start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString(),
      all_day: draft.all_day, color: draft.color, created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Evento criado");
    setDlgOpen(false);
    qc.invalidateQueries({ queryKey: ["events"] });
  };

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
          <Button onClick={() => setDlgOpen(true)}><Plus className="w-4 h-4 mr-1" />Novo evento</Button>
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
            const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), d));
            const isCurrent = isSameMonth(d, cursor);
            const isTod = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className={"min-h-24 border-r border-b p-1.5 " + (isCurrent ? "" : "bg-muted/30 text-muted-foreground")}>
                <div className={"text-xs font-medium mb-1 " + (isTod ? "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center" : "")}>
                  {format(d, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div key={e.id} className="text-[10px] truncate px-1.5 py-0.5 rounded" style={{ background: e.color + "25", color: e.color }}>
                      {e.all_day ? "" : format(parseISO(e.start_at), "HH:mm ")}{e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
            <DialogDescription>Crie um evento na agenda compartilhada</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={draft.all_day} onCheckedChange={(v) => setDraft({ ...draft, all_day: v })} /><Label>Dia inteiro</Label></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Data</Label><Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
              {!draft.all_day && <><div><Label>Início</Label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></div></>}
            </div>
            <div><Label>Cor</Label><Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-24" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-4"><Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancelar</Button><Button onClick={createEvent}>Criar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
