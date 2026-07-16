import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchProfiles } from "@/lib/workspace-data";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, ChevronRight, ChevronDown, FileText, Star, Search, Lock, Globe,
  Share2, MoreHorizontal, UserPlus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notas")({
  ssr: false,
  component: NotesPage,
});

interface Note {
  id: string;
  owner_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: unknown;
  is_private: boolean;
  archived: boolean;
  pinned: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface NoteShare {
  id: string;
  note_id: string;
  shared_with_id: string;
  permission: "view" | "edit";
  created_by: string;
  created_at: string;
}

const DEFAULT_CONTENT = { type: "doc", content: [{ type: "paragraph" }] };

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes").select("*").eq("archived", false)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
        qc.invalidateQueries({ queryKey: ["notes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const canEdit = !!selected && !!user && selected.owner_id === user.id; // extended below via shares

  const createNote = useMutation({
    mutationFn: async (parentId: string | null) => {
      if (!user) throw new Error("no user");
      const { data, error } = await supabase.from("notes").insert({
        owner_id: user.id,
        parent_id: parentId,
        title: "Sem título",
        content: DEFAULT_CONTENT,
      }).select().single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(n.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNote = useMutation({
    mutationFn: async (patch: Partial<Note> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("notes").update(rest as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(null);
      toast.success("Anotação excluída");
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, search]);

  const myNotes = filtered.filter((n) => n.owner_id === user?.id);
  const sharedNotes = filtered.filter((n) => n.owner_id !== user?.id);

  const tree = useMemo(() => buildTree(myNotes), [myNotes]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-sidebar/40 flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Anotações</h2>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => createNote.mutate(null)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 pl-7 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5">Minhas anotações</div>
          {tree.length === 0 && (
            <button onClick={() => createNote.mutate(null)} className="w-full text-left text-xs text-muted-foreground px-2 py-2 hover:bg-accent rounded-md">
              + Criar primeira anotação
            </button>
          )}
          {tree.map((n) => (
            <NoteTreeItem key={n.id} note={n} depth={0} allNotes={myNotes} selectedId={selectedId} onSelect={setSelectedId} onCreateChild={(pid) => createNote.mutate(pid)} onDelete={(id) => deleteNote.mutate(id)} />
          ))}
          {sharedNotes.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 mt-4">Compartilhadas comigo</div>
              {sharedNotes.map((n) => (
                <button key={n.id} onClick={() => setSelectedId(n.id)}
                  className={cn("w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-left",
                    selectedId === n.id && "bg-accent")}>
                  <span className="text-base leading-none">{n.icon || "📄"}</span>
                  <span className="truncate flex-1">{n.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Main editor */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <div className="text-sm">Selecione ou crie uma anotação</div>
              <Button size="sm" className="mt-4" onClick={() => createNote.mutate(null)}><Plus className="w-4 h-4 mr-1" />Nova anotação</Button>
            </div>
          </div>
        ) : (
          <NoteView
            key={selected.id}
            note={selected}
            canEdit={canEdit}
            onUpdate={(patch) => updateNote.mutate({ id: selected.id, ...patch })}
            onDelete={() => deleteNote.mutate(selected.id)}
            onShare={() => setShareOpen(true)}
          />
        )}
      </main>

      {selected && (
        <ShareNoteDialog open={shareOpen} onOpenChange={setShareOpen} note={selected} />
      )}
    </div>
  );
}

interface TreeNode extends Note { children: TreeNode[] }
function buildTree(list: Note[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  list.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((n) => {
    if (n.parent_id && map.has(n.parent_id)) map.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function NoteTreeItem({ note, depth, allNotes, selectedId, onSelect, onCreateChild, onDelete }: {
  note: TreeNode; depth: number; allNotes: Note[]; selectedId: string | null;
  onSelect: (id: string) => void; onCreateChild: (parentId: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = note.children.length > 0;
  return (
    <div>
      <div className={cn("group flex items-center gap-0.5 rounded-md hover:bg-accent",
        selectedId === note.id && "bg-accent")} style={{ paddingLeft: depth * 12 }}>
        <button className="w-5 h-6 flex items-center justify-center text-muted-foreground shrink-0" onClick={() => setOpen(!open)}>
          {hasChildren ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
        </button>
        <button onClick={() => onSelect(note.id)} className="flex-1 flex items-center gap-1.5 py-1 text-sm text-left min-w-0">
          <span className="text-base leading-none">{note.icon || "📄"}</span>
          <span className="truncate flex-1">{note.title}</span>
          {note.is_private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
          {note.pinned && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
        </button>
        <div className="opacity-0 group-hover:opacity-100 flex items-center pr-1">
          <button onClick={() => onCreateChild(note.id)} title="Sub-página" className="p-1 hover:bg-muted rounded"><Plus className="w-3 h-3" /></button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 hover:bg-muted rounded"><MoreHorizontal className="w-3 h-3" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {open && hasChildren && (
        <div>
          {note.children.map((c) => (
            <NoteTreeItem key={c.id} note={c} depth={depth + 1} allNotes={allNotes} selectedId={selectedId} onSelect={onSelect} onCreateChild={onCreateChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

const EMOJIS = ["📄", "📝", "📚", "💡", "✨", "🎯", "🚀", "📌", "🔖", "⭐", "🔥", "💼", "🗂️", "📊", "🧠", "❤️", "☕", "🌱"];

function NoteView({ note, canEdit, onUpdate, onDelete, onShare }: {
  note: Note; canEdit: boolean;
  onUpdate: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<unknown>(note.content);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.id]);

  const scheduleSave = (patch: Partial<Note>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(patch), 500);
  };

  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-8 py-2 border-b border-border">
        <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
          {note.is_private ? <><Lock className="w-3.5 h-3.5" />Particular</> : <><Globe className="w-3.5 h-3.5" />Compartilhável</>}
        </div>
        {canEdit && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Particular</span>
              <Switch checked={note.is_private} onCheckedChange={(v) => onUpdate({ is_private: v })} />
            </div>
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ pinned: !note.pinned })}>
              <Star className={cn("w-4 h-4", note.pinned && "fill-amber-400 text-amber-400")} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onShare}><Share2 className="w-4 h-4 mr-1" />Compartilhar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir anotação</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <div className="flex items-center gap-2 mb-3">
            <DropdownMenu open={emojiOpen} onOpenChange={setEmojiOpen}>
              <DropdownMenuTrigger asChild>
                <button className="text-5xl leading-none hover:bg-accent rounded-md p-1 -m-1" disabled={!canEdit}>
                  {note.icon || "📄"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="grid grid-cols-6 gap-1 p-2 w-auto">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { onUpdate({ icon: e }); setEmojiOpen(false); }} className="text-xl hover:bg-accent rounded p-1">{e}</button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
            placeholder="Sem título"
            className="w-full text-4xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 mb-6"
          />
          <NoteEditor
            value={content}
            editable={canEdit}
            onChange={(json) => { setContent(json); scheduleSave({ content: json }); }}
          />
        </div>
      </div>
    </div>
  );
}

function ShareNoteDialog({ open, onOpenChange, note }: { open: boolean; onOpenChange: (v: boolean) => void; note: Note }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [perm, setPerm] = useState<"view" | "edit">("view");

  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: shares = [] } = useQuery({
    queryKey: ["note-shares", note.id],
    queryFn: async () => {
      const { data } = await supabase.from("note_shares").select("*").eq("note_id", note.id);
      return (data ?? []) as NoteShare[];
    },
  });

  const addShare = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.from("note_shares").insert({
        note_id: note.id, shared_with_id: targetId, permission: perm, created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: targetId, type: "share",
        title: "Anotação compartilhada com você",
        message: `${note.icon || "📄"} ${note.title}`,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-shares", note.id] }); toast.success("Compartilhado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("note_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["note-shares", note.id] }),
  });

  const sharedIds = new Set(shares.map((s) => s.shared_with_id));
  const candidates = profiles.filter((p) =>
    p.id !== user?.id && !sharedIds.has(p.id) &&
    (!q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Compartilhar anotação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Buscar pessoa..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={perm} onValueChange={(v) => setPerm(v as "view" | "edit")}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Ver</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {q && (
            <div className="border rounded-md max-h-48 overflow-auto">
              {candidates.slice(0, 8).map((p) => (
                <button key={p.id} onClick={() => addShare.mutate(p.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left">
                  <Avatar className="w-7 h-7"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.name[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><div className="text-sm truncate">{p.name}</div><div className="text-xs text-muted-foreground truncate">{p.email}</div></div>
                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
              {candidates.length === 0 && <div className="text-xs text-muted-foreground px-3 py-2">Ninguém encontrado</div>}
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Com acesso ({shares.length})</div>
            <div className="space-y-1">
              {shares.map((s) => {
                const p = profiles.find((x) => x.id === s.shared_with_id);
                return (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent">
                    <Avatar className="w-7 h-7"><AvatarImage src={p?.avatar_url ?? undefined} /><AvatarFallback>{p?.name[0] ?? "?"}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0 text-sm truncate">{p?.name ?? "Usuário"}</div>
                    <Badge variant="secondary" className="text-[10px]">{s.permission === "edit" ? "Editar" : "Ver"}</Badge>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeShare.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              })}
              {shares.length === 0 && <div className="text-xs text-muted-foreground px-2">Ninguém ainda</div>}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
