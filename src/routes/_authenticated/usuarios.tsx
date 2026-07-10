import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles, fetchSectors } from "@/lib/workspace-data";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useHasRole } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  component: UsuariosPage,
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" }, { value: "rh", label: "RH" },
  { value: "gestor", label: "Gestor" }, { value: "colaborador", label: "Colaborador" },
];

function UsuariosPage() {
  const qc = useQueryClient();
  const isAdmin = useHasRole("admin");
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: sectors = [] } = useQuery({ queryKey: ["sectors"], queryFn: fetchSectors });
  const { data: rolesMap = {} } = useQuery({
    queryKey: ["roles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id,role");
      const m: Record<string, AppRole[]> = {};
      (data ?? []).forEach((r: { user_id: string; role: AppRole }) => (m[r.user_id] ||= []).push(r.role));
      return m;
    },
  });

  const [edit, setEdit] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const editingProfile = profiles.find((p) => p.id === edit.id);

  const [form, setForm] = useState({ name: "", cargo: "", phone: "", sector_id: "", role: "colaborador" as AppRole, status: true });

  const openEdit = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    setForm({
      name: p?.name ?? "", cargo: p?.cargo ?? "", phone: "", sector_id: p?.sector_id ?? "",
      role: rolesMap[id]?.[0] ?? "colaborador", status: true,
    });
    setEdit({ open: true, id });
  };

  const save = async () => {
    if (!edit.id) return;
    await supabase.from("profiles").update({
      name: form.name, cargo: form.cargo, sector_id: form.sector_id || null,
      status: form.status ? "active" : "inactive",
    }).eq("id", edit.id);
    if (isAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", edit.id);
      await supabase.from("user_roles").insert({ user_id: edit.id, role: form.role });
    }
    toast.success("Usuário atualizado");
    qc.invalidateQueries({ queryKey: ["profiles"] });
    qc.invalidateQueries({ queryKey: ["roles-map"] });
    setEdit({ open: false, id: null });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground text-sm">Colaboradores cadastrados no workspace</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => {
          const roles = rolesMap[p.id] ?? [];
          const sec = sectors.find((s) => s.id === p.sector_id);
          return (
            <Card key={p.id} className="p-4 hover:shadow-elegant transition-all cursor-pointer" onClick={() => openEdit(p.id)}>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.name?.[0] ?? "?"}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  {p.cargo && <div className="text-xs text-muted-foreground truncate">{p.cargo}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {roles.map((r) => <Badge key={r} variant="secondary" className="capitalize text-[10px]">{r}</Badge>)}
                {sec && <Badge variant="outline" className="text-[10px]" style={{ borderColor: sec.color, color: sec.color }}>{sec.name}</Badge>}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={edit.open} onOpenChange={(o) => setEdit({ open: o, id: o ? edit.id : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={editingProfile?.email ?? ""} disabled /></div>
            <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            <div>
              <Label>Setor</Label>
              <Select value={form.sector_id} onValueChange={(v) => setForm({ ...form, sector_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div>
                <Label>Nível de acesso</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2"><Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} /><Label>Ativo</Label></div>
          </div>
          <div className="flex justify-end gap-2 pt-3"><Button variant="ghost" onClick={() => setEdit({ open: false, id: null })}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
