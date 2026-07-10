import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchSectors, fetchStatuses } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useHasRole } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  ssr: false,
  component: ConfigPage,
});

type EntityType = "sectors" | "categories" | "task_statuses";

function ConfigPage() {
  const isAdmin = useHasRole("admin");
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Apenas administradores podem acessar as configurações.</div>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie setores, categorias e status do workspace</p>
      </div>
      <Tabs defaultValue="setores">
        <TabsList>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
        <TabsContent value="setores"><EntityManager type="sectors" title="Setores" /></TabsContent>
        <TabsContent value="categorias"><EntityManager type="categories" title="Categorias" /></TabsContent>
        <TabsContent value="status"><StatusManager /></TabsContent>
      </Tabs>
    </div>
  );
}

function EntityManager({ type, title }: { type: "sectors" | "categories"; title: string }) {
  const qc = useQueryClient();
  const key = type === "sectors" ? ["sectors"] : ["categories"];
  const fetcher = type === "sectors" ? fetchSectors : fetchCategories;
  const { data = [] } = useQuery({ queryKey: key, queryFn: fetcher });

  const [dlg, setDlg] = useState<{ open: boolean; item: { id?: string; name?: string; description?: string | null; color?: string; icon?: string } | null }>({ open: false, item: null });

  const save = async () => {
    const it = dlg.item!;
    if (!it.name?.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = { name: it.name.trim(), description: it.description ?? null, color: it.color ?? "#22c55e", icon: it.icon ?? (type === "sectors" ? "Briefcase" : "Tag") };
    if (it.id) await supabase.from(type).update(payload).eq("id", it.id);
    else await supabase.from(type).insert(payload);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: key });
    setDlg({ open: false, item: null });
  };

  const del = async (id: string) => {
    if (!confirm("Excluir?")) return;
    await supabase.from(type).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
    toast.success("Excluído");
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        <Button size="sm" onClick={() => setDlg({ open: true, item: { color: "#22c55e" } })}><Plus className="w-4 h-4 mr-1" />Novo</Button>
      </div>
      <div className="divide-y">
        {data.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded" style={{ background: s.color }} />
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setDlg({ open: true, item: s })}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(s.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o, item: o ? dlg.item : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg.item?.id ? "Editar" : "Novo"} {title.slice(0, -1)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={dlg.item?.name ?? ""} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, name: e.target.value } })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={dlg.item?.description ?? ""} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, description: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cor</Label><Input type="color" className="h-10" value={dlg.item?.color ?? "#22c55e"} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, color: e.target.value } })} /></div>
              <div><Label>Ícone (Lucide)</Label><Input value={dlg.item?.icon ?? ""} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, icon: e.target.value } })} placeholder="ex: Briefcase" /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button variant="ghost" onClick={() => setDlg({ open: false, item: null })}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusManager() {
  const qc = useQueryClient();
  const { data: statuses = [] } = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const [dlg, setDlg] = useState<{ open: boolean; item: { id?: string; name?: string; color?: string; position?: number; is_done?: boolean } | null }>({ open: false, item: null });

  const save = async () => {
    const it = dlg.item!;
    const payload = { name: it.name, color: it.color ?? "#94a3b8", position: it.position ?? 0, is_done: !!it.is_done };
    if (it.id) await supabase.from("task_statuses").update(payload).eq("id", it.id);
    else await supabase.from("task_statuses").insert(payload);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["statuses"] });
    setDlg({ open: false, item: null });
  };
  const del = async (id: string) => { if (!confirm("Excluir?")) return; await supabase.from("task_statuses").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["statuses"] }); };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Status personalizados</h2>
        <Button size="sm" onClick={() => setDlg({ open: true, item: { color: "#94a3b8", position: statuses.length } })}><Plus className="w-4 h-4 mr-1" />Novo status</Button>
      </div>
      <div className="divide-y">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <div className="font-medium text-sm">{s.name}</div>
              {s.is_done && <span className="text-[10px] text-success uppercase tracking-wider">Concluído</span>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setDlg({ open: true, item: s })}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(s.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o, item: o ? dlg.item : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Status</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={dlg.item?.name ?? ""} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, name: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cor</Label><Input type="color" className="h-10" value={dlg.item?.color ?? "#94a3b8"} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, color: e.target.value } })} /></div>
              <div><Label>Posição</Label><Input type="number" value={dlg.item?.position ?? 0} onChange={(e) => setDlg({ ...dlg, item: { ...dlg.item!, position: Number(e.target.value) } })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={!!dlg.item?.is_done} onCheckedChange={(v) => setDlg({ ...dlg, item: { ...dlg.item!, is_done: v } })} /><Label>Representa "Concluído"</Label></div>
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button variant="ghost" onClick={() => setDlg({ open: false, item: null })}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
