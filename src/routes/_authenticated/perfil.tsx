import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/perfil")({
  ssr: false,
  component: PerfilPage,
});

function PerfilPage() {
  const { profile, user, refresh } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", cargo: "", phone: "" });

  useEffect(() => {
    if (profile) setForm({ name: profile.name ?? "", cargo: profile.cargo ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  const initials = (profile?.name || profile?.email || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const onPickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw signErr ?? new Error("Falha ao gerar URL");
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", user.id);
      if (updErr) throw updErr;
      await refresh();
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: form.name, cargo: form.cargo || null, phone: form.phone || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    qc.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Perfil salvo");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground text-sm">Atualize sua foto e informações pessoais</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={onPickFile}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
              aria-label="Alterar foto"
            >
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-lg">{profile?.name || "Sem nome"}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <Button variant="outline" size="sm" onClick={onPickFile} disabled={uploading} className="mt-2">
              {uploading ? "Enviando..." : "Alterar foto"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
