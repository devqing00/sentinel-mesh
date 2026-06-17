"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Activity, ShieldCheck, Lock, Mail, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm mb-4 bg-primary text-primary-foreground">
          <Activity className="w-8 h-8 text-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sentinel Mesh
        </h1>
        <p className="text-sm mt-2 text-muted-foreground">Secure Health Surveillance Operations</p>
      </div>

      <Card className="w-full max-w-md bg-card backdrop-blur-xl border-border animate-slide-up shadow-2xl">
        <CardHeader className="border-b border-border pb-4 mb-6">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Authorized Access Only
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="mb-6 p-3 rounded-md text-sm flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Agency Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="operator@ncdc.gov.ng"
                  className="pl-10 bg-background border-input focus-visible:ring-ring"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-10 bg-background border-input focus-visible:ring-ring"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              {loading ? "Authenticating..." : "Secure Login"}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="justify-center pt-2 pb-6">
          <div className="text-center text-xs text-muted-foreground">
            By logging in, you agree to the Sentinel Mesh strict data privacy and handling protocols.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
