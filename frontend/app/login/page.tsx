"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Activity, ShieldCheck, Lock, Mail, Loader2, AlertTriangle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0b1021]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none" />

      <div className="z-10 w-full max-w-md p-6 animate-fade-in">
        <div className="mb-10 flex flex-col items-center">
          <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-xl group-hover:bg-blue-400/40 transition-all duration-500" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl flex items-center justify-center shadow-2xl">
              <Activity className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Sentinel Mesh
          </h1>
          <p className="text-slate-400 text-center text-sm font-medium tracking-wide uppercase letter-spacing-2">
            Secure Health Surveillance
          </p>
        </div>

        <div className="bg-[#1e2336]/80 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle inner highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
          
          <div className="flex items-center gap-2 mb-8 justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-emerald-400 font-semibold tracking-wide uppercase text-sm">Authorized Access Only</h2>
          </div>
          
          {error && (
            <div className="mb-6 p-4 rounded-xl text-sm flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 animate-slide-up">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 relative group">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Agency Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="operator@ncdc.gov.ng"
                  className="pl-12 h-14 bg-[#0b1021]/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 rounded-xl transition-all"
                />
              </div>
            </div>
            
            <div className="space-y-2 relative group">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Secure Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="pl-12 h-14 bg-[#0b1021]/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 rounded-xl transition-all"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-14 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all duration-300 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Initiate Secure Session
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <p className="text-center text-xs text-slate-500 leading-relaxed">
              By accessing this system, you agree to the <span className="text-slate-300">Sentinel Mesh Data Privacy Protocol</span>. Unauthorized access will be logged and reported.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
