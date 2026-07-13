import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles, type ProfileLite } from "@/lib/workspace-data";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Users, Share2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compartilhamentos")({
  ssr: false,
  component: SharesPage,
});

type SharePermission = "view" | "edit";
interface Share {
  id: string;
  owner_id: string;
  shared_with_id: string;
  permission: SharePermission;
  created_at: string;
}

function SharesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const { data: outgoing = [] } = useQuery({
    queryKey: ["shares", "outgoing", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("task_list_shares").select("*").eq("owner_id", user.id);
      return (data ?? []) as Share[];
    },
    enabled: !!user,
  });

  const { data: incoming = [] } = useQuery({
    queryKey: ["shares", "incoming", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("task_list_shares").select("*").eq("shared_with_id", user.id);
      return (data ?? []) as Share[];
    },
    enabled: !!user,
  });

  const addShare = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from("task_list_shares").insert({
        owner_id: user!.id, shared_with_id: targetId, permission: "view",
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: targetId,
        title: "Lista de tarefas compartilhada",
        message: "Você agora tem acesso à lista de tarefas de outro usuário.",
        type: "share",
      });
    },
    onSuccess: () => {
      toast.success("Usuário adicionado");
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setPickerOpen(false);
      setQ("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updatePerm = useMutation({
    mutationFn: async ({ id, permission }: { id: string; permission: SharePermission }) => {
      const { error } = await supabase.from("task_list_shares").update({ permission }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries({ queryKey: ["shares"] }); },
  });

  const removeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_list_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compartilhamento removido");
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const profileById = (id: string): ProfileLite | undefined => profiles.find((p) => p.id === id);
  const outgoingIds = new Set(outgoing.map((s) => s.shared_with_id));
  const searchable = profiles.filter(
    (p) => p.id !== user?.id && !outgoingIds.has(p.id) && p.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" /> Compartilhamentos
          </h1>
          <p className="text-muted-foreground text-sm">Convide colegas para ver e colaborar na sua lista de tarefas</p>
        </div>
        <Button onClick={() => setPickerOpen((v) => !v)}>
          <UserPlus className="w-4 h-4 mr-1" /> Convidar usuário
        </Button>
      </div>

      {pickerOpen && (
        <Card className="p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuário pelo nome..." className="pl-9" autoFocus />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {searchable.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum usuário disponível.</p>}
            {searchable.map((p) => (
              <button
                key={p.id}
                onClick={() => addShare.mutate(p.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
              >
                <Avatar className="w-9 h-9"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.name[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.cargo || p.email}</div>
                </div>
                <UserPlus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Compartilhei com ({outgoing.length})</h2>
          </div>
          <div className="space-y-2">
            {outgoing.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Você ainda não compartilhou sua lista.</p>}
            {outgoing.map((s) => {
              const p = profileById(s.shared_with_id);
              return (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-md border">
                  <Avatar className="w-9 h-9"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{p?.name?.[0] ?? "?"}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p?.name ?? "Usuário"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.email}</div>
                  </div>
                  <Select value={s.permission} onValueChange={(v) => updatePerm.mutate({ id: s.id, permission: v as SharePermission })}>
                    <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Ver</SelectItem>
                      <SelectItem value="edit">Editar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeShare.mutate(s.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Compartilhado comigo ({incoming.length})</h2>
          </div>
          <div className="space-y-2">
            {incoming.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma lista foi compartilhada com você.</p>}
            {incoming.map((s) => {
              const p = profileById(s.owner_id);
              return (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-md border">
                  <Avatar className="w-9 h-9"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{p?.name?.[0] ?? "?"}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p?.name ?? "Usuário"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.email}</div>
                  </div>
                  <Badge variant={s.permission === "edit" ? "default" : "secondary"}>
                    {s.permission === "edit" ? "Pode editar" : "Somente leitura"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
