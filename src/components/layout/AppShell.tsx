import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard, ListTodo, Calendar, Users, Settings, Bell, Search,
  LogOut, Moon, Sun, Leaf, KanbanSquare, BarChart3, Share2, UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import lenotreLogo from "@/assets/lenotre-logo.jpeg.asset.json";
import { useAuth, useHasRole } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "rh", "gestor", "colaborador"] as const },
  { to: "/tarefas", icon: ListTodo, label: "Tarefas", roles: ["admin", "rh", "gestor", "colaborador"] as const },
  { to: "/kanban", icon: KanbanSquare, label: "Kanban", roles: ["admin", "rh", "gestor", "colaborador"] as const },
  { to: "/agenda", icon: Calendar, label: "Agenda", roles: ["admin", "rh", "gestor", "colaborador"] as const },
  { to: "/compartilhamentos", icon: Share2, label: "Compartilhar", roles: ["admin", "rh", "gestor", "colaborador"] as const },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios", roles: ["admin", "rh", "gestor"] as const },
  { to: "/usuarios", icon: Users, label: "Usuários", roles: ["admin", "rh"] as const },
  { to: "/configuracoes", icon: Settings, label: "Configurações", roles: ["admin"] as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: unread = 0 } = useQuery({
    queryKey: ["notif-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (profile?.name || profile?.email || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const filteredNav = nav;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-5 flex items-center gap-2.5 border-b border-sidebar-border">
          <img src={lenotreLogo.url} alt="Le Nôtre" className="w-9 h-9 rounded-lg object-cover shadow-elegant" />
          <div>
            <div className="font-bold text-sm tracking-tight text-sidebar-foreground">Le Nôtre</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {filteredNav.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 pb-2">Conta</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/60 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate">{profile?.name || "Usuário"}</div>
                  <div className="text-xs text-muted-foreground truncate capitalize">{roles[0] || "colaborador"}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                <UserCircle className="w-4 h-4 mr-2" /> Meu perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                Modo {theme === "dark" ? "claro" : "escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Buscar tarefas, pessoas, eventos...</span>
            <kbd className="ml-auto hidden sm:inline text-[10px] px-1.5 py-0.5 bg-muted rounded">⌘K</kbd>
          </button>
          <div className="flex items-center gap-1 ml-auto">
            <NotificationsPopover>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
                    {unread > 9 ? "9+" : unread}
                  </Badge>
                )}
              </Button>
            </NotificationsPopover>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t border-border bg-card flex justify-around py-2">
          {filteredNav.slice(0, 5).map((i) => {
            const active = loc.pathname.startsWith(i.to);
            return (
              <Link key={i.to} to={i.to} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
                <i.icon className="w-5 h-5" />
                {i.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
