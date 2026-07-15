import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import lenotreLogo from "@/assets/lenotre-logo.jpeg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPass,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name: signupName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <img src={lenotreLogo.url} alt="Le Nôtre" className="w-11 h-11 rounded-xl object-cover shadow-elegant" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Le Nôtre Workspace</h1>
            <p className="text-xs text-muted-foreground">Central corporativa</p>
          </div>
        </Link>

        <Card className="p-6 shadow-elevated">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="li-email">Email</Label>
                  <Input id="li-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="li-pass">Senha</Label>
                  <Input id="li-pass" type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome completo</Label>
                  <Input id="su-name" required value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Seu nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pass">Senha</Label>
                  <Input id="su-pass" type="password" required minLength={6} value={signupPass} onChange={(e) => setSignupPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  O primeiro usuário cadastrado é automaticamente Administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
