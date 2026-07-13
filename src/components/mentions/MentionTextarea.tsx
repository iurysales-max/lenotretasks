import { useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ProfileLite } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  profiles: ProfileLite[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

/**
 * Textarea with @mention autocomplete.
 * Mentions are inserted as "@Nome" — resolved to user_id on submit by parseMentions().
 */
export function MentionTextarea({ value, onChange, onSubmit, profiles, placeholder, rows = 2, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState(0);
  const [hi, setHi] = useState(0);

  const suggestions = open
    ? profiles.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const m = before.match(/(?:^|\s)@([\wÀ-ÿ]*)$/);
    if (m) {
      setOpen(true);
      setQuery(m[1]);
      setAnchor(pos - m[1].length - 1);
      setHi(0);
    } else {
      setOpen(false);
    }
  };

  const insertMention = (p: ProfileLite) => {
    const before = value.slice(0, anchor);
    const after = value.slice((ref.current?.selectionStart ?? value.length));
    const inserted = `@${p.name.replace(/\s+/g, "\u00A0")} `;
    const next = before + inserted + after;
    onChange(next);
    setOpen(false);
    setTimeout(() => {
      const p2 = (before + inserted).length;
      ref.current?.focus();
      ref.current?.setSelectionRange(p2, p2);
    }, 0);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(suggestions[hi]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit && !open) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={onKey}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-50 p-1">
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm",
                i === hi ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <Avatar className="w-6 h-6"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{p.name[0]}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                {p.cargo && <div className="text-[10px] text-muted-foreground truncate">{p.cargo}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extracts mentioned user IDs from text by matching profile names. */
export function parseMentions(text: string, profiles: ProfileLite[]): string[] {
  const found = new Set<string>();
  const normalized = text.replace(/\u00A0/g, " ");
  for (const p of profiles) {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@${escaped}(?=\\b|\\s|$)`, "i");
    if (re.test(normalized)) found.add(p.id);
  }
  return Array.from(found);
}

/** Renders text with @mentions highlighted. */
export function renderMentions(text: string, profiles: ProfileLite[]): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const normalized = text.replace(/\u00A0/g, " ");
  const names = profiles.map((p) => p.name).sort((a, b) => b.length - a.length);
  if (!names.length) return [normalized];
  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = pattern.exec(normalized)) !== null) {
    if (m.index > last) parts.push(normalized.slice(last, m.index));
    parts.push(<span key={k++} className="text-primary font-medium bg-primary/10 rounded px-1">@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < normalized.length) parts.push(normalized.slice(last));
  return parts;
}
