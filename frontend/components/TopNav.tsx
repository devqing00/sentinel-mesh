"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, RadioTower, ShieldAlert, Map, LayoutDashboard, Shield, Battery, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: RadioTower },
  { href: "/devices", label: "Devices", icon: Battery },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/audit", label: "Audit", icon: Shield },
  { href: "/kiosks", label: "Kiosks", icon: Map },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Don't render nav on the login page
  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b">
      <div className="max-w-screen-2xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground">
            <Activity className="w-4.5 h-4.5 text-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">
            Sentinel Mesh
          </span>
        </Link>
        
        {user && (
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'text-primary bg-primary/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                )
              })}
            </div>
            
            <div className="h-6 w-px bg-border mx-2"></div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => signOut()}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
