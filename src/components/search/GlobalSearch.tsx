import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListTodo, Users, Tag, Briefcase, Calendar as CalIcon } from "lucide-react";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function GlobalSearch({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  const { data } = useQuery({
    queryKey: ["global-search", q],
    queryFn: async () => {
      if (!q.trim()) return { tasks: [], people: [], sectors: [], cats: [], events: [] };
      const like = `%${q}%`;
      const [tasks, people, sectors, cats, events] = await Promise.all([
        supabase.from("tasks").select("id,title").ilike("title", like).limit(5),
        supabase.from("profiles").select("id,name,email").or(`name.ilike.${like},email.ilike.${like}`).limit(5),
        supabase.from("sectors").select("id,name").ilike("name", like).limit(5),
        supabase.from("categories").select("id,name").ilike("name", like).limit(5),
        supabase.from("calendar_events").select("id,title").ilike("title", like).limit(5),
      ]);
      return {
        tasks: tasks.data ?? [],
        people: people.data ?? [],
        sectors: sectors.data ?? [],
        cats: cats.data ?? [],
        events: events.data ?? [],
      };
    },
    enabled: open,
  });

  const go = (to: string) => { onOpenChange(false); navigate({ to }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Pesquisar em todo o workspace..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {data?.tasks.length ? (
          <CommandGroup heading="Tarefas">
            {data.tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => go(`/tarefas?open=${t.id}`)}>
                <ListTodo className="w-4 h-4 mr-2" /> {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {data?.people.length ? (
          <CommandGroup heading="Pessoas">
            {data.people.map((p) => (
              <CommandItem key={p.id} onSelect={() => go("/usuarios")}>
                <Users className="w-4 h-4 mr-2" /> {p.name || p.email}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {data?.sectors.length ? (
          <CommandGroup heading="Setores">
            {data.sectors.map((s) => (
              <CommandItem key={s.id} onSelect={() => go("/configuracoes")}>
                <Briefcase className="w-4 h-4 mr-2" /> {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {data?.cats.length ? (
          <CommandGroup heading="Categorias">
            {data.cats.map((c) => (
              <CommandItem key={c.id} onSelect={() => go("/configuracoes")}>
                <Tag className="w-4 h-4 mr-2" /> {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {data?.events.length ? (
          <CommandGroup heading="Eventos">
            {data.events.map((e) => (
              <CommandItem key={e.id} onSelect={() => go("/agenda")}>
                <CalIcon className="w-4 h-4 mr-2" /> {e.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
