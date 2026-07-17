import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchProfiles, type ProfileLite } from "@/lib/workspace-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus, Search, Mail, Phone, MapPin, Briefcase, FileText, Upload, CalendarPlus,
  Trash2, MessageSquare, UserCheck, Clock, Video, ExternalLink, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/recrutamento")({
  ssr: false,
  component: RecruitmentPage,
});

interface CandidateStatus { id: string; name: string; color: string; position: number; is_terminal: boolean; }
interface Candidate {
  id: string; name: string; email: string | null; phone: string | null; city: string | null;
  job_title: string | null; resume_url: string | null; notes: string | null;
  status_id: string | null; owner_id: string | null; created_by: string;
  hired_profile_id: string | null; created_at: string; updated_at: string;
}
interface Activity {
  id: string; candidate_id: string; type: string; content: string | null;
  metadata: Record<string, unknown>; created_by: string; created_at: string;
}
interface Interview {
  id: string; candidate_id: string; scheduled_at: string; duration_minutes: number;
  location: string | null; meeting_url: string | null; event_id: string | null;
  interviewer_id: string | null; notes: string | null; outcome: string | null;
  created_by: string; created_at: string;
}

function RecruitmentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: statuses = [] } = useQuery({
    queryKey: ["cand-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("candidate_status").select("*").order("position");
      return (data ?? []) as CandidateStatus[];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Candidate[];
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("rec-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () => qc.invalidateQueries({ queryKey: ["candidates"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "candidate_activities" }, () => qc.invalidateQueries({ queryKey: ["cand-activities"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "candidate_interviews" }, () => qc.invalidateQueries({ queryKey: ["cand-interviews"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return candidates.filter((c) => {
      if (filterStatus !== "all" && c.status_id !== filterStatus) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || (c.email ?? "").toLowerCase().includes(q)
        || (c.job_title ?? "").toLowerCase().includes(q)
        || (c.city ?? "").toLowerCase().includes(q);
    });
  }, [candidates, search, filterStatus]);

  // Group by status for kanban view
  const grouped = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    statuses.forEach((s) => map.set(s.id, []));
    filtered.forEach((c) => {
      const list = c.status_id ? map.get(c.status_id) : undefined;
      if (list) list.push(c);
    });
    return map;
  }, [filtered, statuses]);

  const stats = useMemo(() => {
    const byName = new Map<string, number>();
    statuses.forEach((s) => byName.set(s.name, 0));
    candidates.forEach((c) => {
      const s = statuses.find((x) => x.id === c.status_id);
      if (s) byName.set(s.name, (byName.get(s.name) ?? 0) + 1);
    });
    return byName;
  }, [candidates, statuses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recrutamento</h1>
          <p className="text-sm text-muted-foreground">CRM de candidatos, entrevistas e histórico do processo seletivo.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo candidato
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilterStatus(filterStatus === s.id ? "all" : s.id)}
            className={cn(
              "rounded-lg border border-border bg-card p-3 text-left transition-all hover:shadow-sm",
              filterStatus === s.id && "ring-2 ring-primary",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{s.name}</span>
            </div>
            <div className="text-2xl font-bold">{stats.get(s.name) ?? 0}</div>
          </button>
        ))}
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="board">Quadro</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar candidatos..." className="pl-9" />
          </div>
          {filterStatus !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterStatus("all")}>Limpar filtro</Button>
          )}
        </div>

        <TabsContent value="list" className="mt-0">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Candidato</th>
                  <th className="text-left px-4 py-2.5 font-medium">Vaga</th>
                  <th className="text-left px-4 py-2.5 font-medium">Cidade</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Contato</th>
                  <th className="text-left px-4 py-2.5 font-medium">Cadastrado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Nenhum candidato encontrado</td></tr>
                )}
                {filtered.map((c) => {
                  const st = statuses.find((s) => s.id === c.status_id);
                  return (
                    <tr key={c.id} onClick={() => setSelectedId(c.id)} className="border-t border-border hover:bg-accent/40 cursor-pointer">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8"><AvatarFallback>{c.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.job_title || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.city || "—"}</td>
                      <td className="px-4 py-2.5">
                        {st && (
                          <Badge variant="secondary" style={{ background: `${st.color}20`, color: st.color, border: `1px solid ${st.color}40` }}>
                            {st.name}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.phone || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{format(new Date(c.created_at), "dd MMM yyyy", { locale: ptBR })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-0">
          <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto pb-2">
            {statuses.map((s) => {
              const items = grouped.get(s.id) ?? [];
              return (
                <div key={s.id} className="rounded-lg bg-muted/30 border border-border flex flex-col">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs font-semibold uppercase tracking-widest">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="p-2 space-y-1.5 flex-1 min-h-[100px]">
                    {items.map((c) => (
                      <button key={c.id} onClick={() => setSelectedId(c.id)}
                        className="w-full text-left bg-card rounded-md p-2.5 border border-border hover:shadow-sm transition-all">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        {c.job_title && <div className="text-xs text-muted-foreground truncate">{c.job_title}</div>}
                        {c.city && <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <CandidateCreateDialog open={createOpen} onOpenChange={setCreateOpen} statuses={statuses} onCreated={(id) => setSelectedId(id)} />

      {selectedId && (
        <CandidateDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          statuses={statuses}
          profiles={profiles}
        />
      )}
    </div>
  );
}

function CandidateCreateDialog({
  open, onOpenChange, statuses, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; statuses: CandidateStatus[]; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", job_title: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setForm({ name: "", email: "", phone: "", city: "", job_title: "", notes: "" }); setFile(null); };

  const submit = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      let resume_url: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("resumes").upload(path, file);
        if (upErr) throw upErr;
        resume_url = path;
      }
      const status_id = statuses.find((s) => s.name === "Novo")?.id ?? statuses[0]?.id ?? null;
      const { data, error } = await supabase.from("candidates").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        job_title: form.job_title.trim() || null,
        notes: form.notes.trim() || null,
        resume_url,
        status_id,
        created_by: user.id,
        owner_id: user.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("candidate_activities").insert({
        candidate_id: data.id, type: "created", content: "Candidato cadastrado", created_by: user.id,
      });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidato cadastrado");
      reset();
      onOpenChange(false);
      onCreated(data.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo candidato</DialogTitle>
          <DialogDescription>Preencha os dados iniciais. Você pode editar tudo depois.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Vaga</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
          </div>
          <div>
            <Label>Currículo (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <span className="text-xs text-muted-foreground truncate">{file.name}</span>}
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidateDrawer({
  id, onClose, statuses, profiles,
}: { id: string; onClose: () => void; statuses: CandidateStatus[]; profiles: ProfileLite[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: candidate } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Candidate;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["cand-activities", id],
    queryFn: async () => {
      const { data } = await supabase.from("candidate_activities").select("*").eq("candidate_id", id).order("created_at", { ascending: false });
      return (data ?? []) as Activity[];
    },
  });

  const { data: interviews = [] } = useQuery({
    queryKey: ["cand-interviews", id],
    queryFn: async () => {
      const { data } = await supabase.from("candidate_interviews").select("*").eq("candidate_id", id).order("scheduled_at", { ascending: false });
      return (data ?? []) as Interview[];
    },
  });

  const [edit, setEdit] = useState<Partial<Candidate>>({});
  useEffect(() => { setEdit({}); }, [id]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (candidate?.resume_url) {
      supabase.storage.from("resumes").createSignedUrl(candidate.resume_url, 60 * 60).then(({ data }) => {
        setResumeUrl(data?.signedUrl ?? null);
      });
    } else setResumeUrl(null);
  }, [candidate?.resume_url]);

  const updateCandidate = useMutation({
    mutationFn: async (patch: Partial<Candidate>) => {
      const { error } = await supabase.from("candidates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidate", id] }); qc.invalidateQueries({ queryKey: ["candidates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = async (status_id: string) => {
    if (!user || !candidate || status_id === candidate.status_id) return;
    const from = statuses.find((s) => s.id === candidate.status_id)?.name;
    const to = statuses.find((s) => s.id === status_id)?.name;
    await supabase.from("candidates").update({ status_id }).eq("id", id);
    await supabase.from("candidate_activities").insert({
      candidate_id: id, type: "status_change",
      content: `Status alterado${from ? ` de "${from}"` : ""} para "${to}"`,
      metadata: { from: candidate.status_id, to: status_id },
      created_by: user.id,
    });
    qc.invalidateQueries({ queryKey: ["candidate", id] });
    qc.invalidateQueries({ queryKey: ["candidates"] });
    qc.invalidateQueries({ queryKey: ["cand-activities", id] });
  };

  const addNote = async () => {
    if (!user || !noteText.trim()) return;
    await supabase.from("candidate_activities").insert({
      candidate_id: id, type: "note", content: noteText.trim(), created_by: user.id,
    });
    setNoteText("");
    qc.invalidateQueries({ queryKey: ["cand-activities", id] });
  };

  const uploadResume = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("resumes").upload(path, file);
    if (error) { toast.error(error.message); return; }
    await supabase.from("candidates").update({ resume_url: path }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["candidate", id] });
    toast.success("Currículo enviado");
  };

  const deleteCand = async () => {
    if (!confirm("Excluir candidato e todo o histórico?")) return;
    await supabase.from("candidates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["candidates"] });
    toast.success("Candidato excluído");
    onClose();
  };

  const convertToCollaborator = async () => {
    if (!candidate?.email) { toast.error("O candidato precisa ter e-mail cadastrado"); return; }
    toast.info("Envie um convite pela página de Usuários. O candidato manterá o histórico aqui e será marcado como Contratado.");
    const hired = statuses.find((s) => s.name === "Contratado");
    if (hired) await changeStatus(hired.id);
  };

  if (!candidate) return null;
  const currentStatus = statuses.find((s) => s.id === candidate.status_id);

  return (
    <Sheet open={true} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14"><AvatarFallback className="text-lg">{candidate.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">{candidate.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                {candidate.job_title && <span className="text-sm text-muted-foreground flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{candidate.job_title}</span>}
                {candidate.city && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{candidate.city}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Select value={candidate.status_id ?? ""} onValueChange={changeStatus}>
                  <SelectTrigger className="w-52 h-8 text-xs">
                    <SelectValue>
                      {currentStatus && (
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: currentStatus.color }} />
                          {currentStatus.name}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Agendar entrevista
                </Button>
                {currentStatus?.name === "Contratado" || currentStatus?.name === "Aprovado" ? (
                  <Button size="sm" variant="outline" onClick={convertToCollaborator}>
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> Contratar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="p-6">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Dados</TabsTrigger>
            <TabsTrigger value="interviews">Entrevistas ({interviews.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail" icon={<Mail className="w-3.5 h-3.5" />}>
                <Input defaultValue={candidate.email ?? ""} onBlur={(e) => e.target.value !== candidate.email && updateCandidate.mutate({ email: e.target.value || null })} />
              </Field>
              <Field label="Telefone" icon={<Phone className="w-3.5 h-3.5" />}>
                <Input defaultValue={candidate.phone ?? ""} onBlur={(e) => e.target.value !== candidate.phone && updateCandidate.mutate({ phone: e.target.value || null })} />
              </Field>
              <Field label="Cidade" icon={<MapPin className="w-3.5 h-3.5" />}>
                <Input defaultValue={candidate.city ?? ""} onBlur={(e) => e.target.value !== candidate.city && updateCandidate.mutate({ city: e.target.value || null })} />
              </Field>
              <Field label="Vaga" icon={<Briefcase className="w-3.5 h-3.5" />}>
                <Input defaultValue={candidate.job_title ?? ""} onBlur={(e) => e.target.value !== candidate.job_title && updateCandidate.mutate({ job_title: e.target.value || null })} />
              </Field>
              <Field label="Responsável" icon={<UsersIcon className="w-3.5 h-3.5" />}>
                <Select value={candidate.owner_id ?? ""} onValueChange={(v) => updateCandidate.mutate({ owner_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Currículo" icon={<FileText className="w-3.5 h-3.5" />}>
                <div className="flex items-center gap-2">
                  {resumeUrl ? (
                    <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir
                    </a>
                  ) : <span className="text-xs text-muted-foreground">Nenhum</span>}
                  <label className="ml-auto cursor-pointer">
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-md hover:bg-accent"><Upload className="w-3 h-3" />Enviar</span>
                  </label>
                </div>
              </Field>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-1 block">Observações</Label>
              <Textarea
                rows={4}
                defaultValue={candidate.notes ?? ""}
                onBlur={(e) => e.target.value !== candidate.notes && updateCandidate.mutate({ notes: e.target.value || null })}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteCand}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir candidato
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-3">
            <Button size="sm" onClick={() => setScheduleOpen(true)}><CalendarPlus className="w-3.5 h-3.5 mr-1" /> Nova entrevista</Button>
            {interviews.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Nenhuma entrevista agendada.</div>}
            {interviews.map((iv) => (
              <div key={iv.id} className="border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(iv.scheduled_at), "PPP 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Duração: {iv.duration_minutes} min</div>
                    {iv.location && <div className="text-xs text-muted-foreground">Local: {iv.location}</div>}
                    {iv.meeting_url && (
                      <a href={iv.meeting_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                        <Video className="w-3 h-3" /> Abrir link da reunião
                      </a>
                    )}
                    {iv.notes && <div className="text-sm mt-2 whitespace-pre-wrap">{iv.notes}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{iv.outcome || "pendente"}</Badge>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Adicionar nota ao histórico..." value={noteText} onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
              <Button size="sm" onClick={addNote}><MessageSquare className="w-3.5 h-3.5 mr-1" />Registrar</Button>
            </div>
            <div className="space-y-2">
              {activities.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Sem atividades ainda.</div>}
              {activities.map((a) => {
                const author = profiles.find((p) => p.id === a.created_by);
                return (
                  <div key={a.id} className="flex gap-3 border-l-2 border-border pl-3 py-1.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5"><AvatarImage src={author?.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{author?.name?.[0] ?? "?"}</AvatarFallback></Avatar>
                        <span className="text-xs font-medium">{author?.name ?? "Alguém"}</span>
                        <Badge variant="outline" className="text-[9px] uppercase">{activityLabel(a.type)}</Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(a.created_at), "dd MMM, HH:mm", { locale: ptBR })}</span>
                      </div>
                      {a.content && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {scheduleOpen && (
          <ScheduleInterviewDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            candidate={candidate}
            statuses={statuses}
            profiles={profiles}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function activityLabel(t: string): string {
  switch (t) {
    case "created": return "Cadastro";
    case "status_change": return "Status";
    case "note": return "Nota";
    case "interview": return "Entrevista";
    case "email": return "E-mail";
    case "contact": return "Contato";
    case "hired": return "Contratação";
    default: return t;
  }
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</Label>
      {children}
    </div>
  );
}

function ScheduleInterviewDialog({
  open, onOpenChange, candidate, statuses, profiles,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; candidate: Candidate;
  statuses: CandidateStatus[]; profiles: ProfileLite[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [interviewerId, setInterviewerId] = useState(user?.id ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
      const end_at = new Date(new Date(scheduled_at).getTime() + duration * 60 * 1000).toISOString();

      // Create calendar event
      const { data: ev, error: evErr } = await supabase.from("calendar_events").insert({
        title: `Entrevista — ${candidate.name}`,
        description: [
          candidate.job_title && `Vaga: ${candidate.job_title}`,
          meetingUrl && `Link: ${meetingUrl}`,
          location && `Local: ${location}`,
          notes,
        ].filter(Boolean).join("\n"),
        start_at: scheduled_at,
        end_at,
        all_day: false,
        color: "#f59e0b",
        created_by: user.id,
      }).select().single();
      if (evErr) throw evErr;

      const { error: ivErr } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidate.id,
        scheduled_at,
        duration_minutes: duration,
        location: location || null,
        meeting_url: meetingUrl || null,
        event_id: ev.id,
        interviewer_id: interviewerId || null,
        notes: notes || null,
        outcome: "pending",
        created_by: user.id,
      });
      if (ivErr) throw ivErr;

      const scheduledStatus = statuses.find((s) => s.name === "Entrevista Agendada");
      if (scheduledStatus && candidate.status_id !== scheduledStatus.id) {
        await supabase.from("candidates").update({ status_id: scheduledStatus.id }).eq("id", candidate.id);
      }
      await supabase.from("candidate_activities").insert({
        candidate_id: candidate.id, type: "interview",
        content: `Entrevista agendada para ${format(new Date(scheduled_at), "PPP 'às' HH:mm", { locale: ptBR })}`,
        metadata: { event_id: ev.id, meeting_url: meetingUrl },
        created_by: user.id,
      });

      // Notify interviewer
      if (interviewerId && interviewerId !== user.id) {
        await supabase.from("notifications").insert({
          user_id: interviewerId, type: "interview",
          title: "Entrevista atribuída a você",
          message: `${candidate.name} — ${format(new Date(scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`,
        });
      }

      qc.invalidateQueries({ queryKey: ["cand-interviews", candidate.id] });
      qc.invalidateQueries({ queryKey: ["candidate", candidate.id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["cand-activities", candidate.id] });
      toast.success("Entrevista agendada e adicionada à agenda");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar entrevista</DialogTitle>
          <DialogDescription>Cria um evento na agenda do sistema. O envio automático de e-mail e link do Google Meet serão adicionados quando a integração com Google Calendar for ativada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Horário</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Duração</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entrevistador</Label>
              <Select value={interviewerId} onValueChange={setInterviewerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Link da reunião (Meet, Zoom, etc.)</Label>
            <Input placeholder="https://meet.google.com/..." value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
          </div>
          <div>
            <Label>Local (opcional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Presencial - Escritório SP" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Agendando..." : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
