import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface NotifRow {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  type: string;
  created_at: string;
}

export function NotificationsPopover({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      return (data ?? []) as NotifRow[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["notifications", user.id] }); qc.invalidateQueries({ queryKey: ["notif-count", user.id] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    qc.invalidateQueries({ queryKey: ["notif-count", user.id] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm flex items-center gap-2"><Bell className="w-4 h-4" /> Notificações</div>
          <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 text-xs">
            <CheckCheck className="w-3 h-3 mr-1" /> Marcar tudo lido
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sem notificações</div>}
          {items.map((n) => (
            <div key={n.id} className={"p-3 border-b last:border-0 hover:bg-accent/50 " + (!n.read ? "bg-primary/5" : "")}>
              <div className="text-sm font-medium">{n.title}</div>
              {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
              </div>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
