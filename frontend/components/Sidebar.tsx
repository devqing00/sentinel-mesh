"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  RadioTower,
  Battery,
  ShieldAlert,
  Shield,
  Map as MapIcon,
  LogOut,
  ChevronLeft,
  PanelLeftOpen,
  Settings,
  Bell,
  Activity,
  Bot,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebarStore } from "@/lib/sidebarStore";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: RadioTower },
  { href: "/devices", label: "Devices", icon: Battery },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/audit", label: "Audit", icon: Shield },
  { href: "/geography", label: "Geography", icon: MapIcon },
  { href: "/sentinel-ai", label: "Sentinel AI", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { mode, setMode } = useSidebarStore();

  if (pathname === "/login") return null;

  if (mode === "hidden") {
    return (
      <button
        onClick={() => setMode("expanded")}
        className="fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-[#1e2336] text-white shadow-lg hover:shadow-xl transition-all duration-200"
        aria-label="Open sidebar"
        title="Open sidebar"
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>
    );
  }

  const isCollapsed = mode === "collapsed";
  const sidebarWidth = isCollapsed ? "w-[72px]" : "w-[260px]";

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "SM";

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-[#161b2c] border-r border-[#262c40]/30 text-slate-300 transition-all duration-300 ease-in-out shrink-0 z-40",
        sidebarWidth
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-[72px] shrink-0",
          isCollapsed ? "justify-center px-3" : "px-6 gap-3"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        {!isCollapsed && (
          <span className="font-display font-bold text-base text-white tracking-tight whitespace-nowrap">
            Sentinel Mesh
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-4 scrollbar-none">
        {!isCollapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 px-2 mb-3">
            Main
          </p>
        )}

        <div className="flex flex-col space-y-1">
          {mainNavItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname?.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 group relative",
                  isCollapsed
                    ? "justify-center w-10 h-10 mx-auto"
                    : "px-3 py-2.5",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Settings section */}
        <div className="mt-8">
          {!isCollapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 px-2 mb-3">
              Settings
            </p>
          )}
          {isCollapsed && <div className="w-8 h-px bg-[#262c40]/50 mx-auto my-4" />}

          <div className="flex flex-col space-y-1">
            {[
              { icon: Bell, label: "Notifications", href: "/notifications" },
              { icon: Settings, label: "Preferences", href: "/profile" },
            ].map(({ icon: Icon, label, href }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 group relative",
                    isCollapsed ? "justify-center w-10 h-10 mx-auto" : "px-3 py-2.5",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                    )}
                  />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 mt-auto">
        <div
          className={cn(
            "bg-[#1e2336] border border-[#262c40]/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col",
            isCollapsed ? "p-2 items-center" : "p-3"
          )}
        >
          <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "gap-3")}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner">
              {initials}
            </div>
            
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white truncate">
                  {user?.email?.split("@")[0] || "Operator"}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                  {role?.replace('_', ' ') || "User"}
                </p>
              </div>
            )}
            
            {!isCollapsed && (
              <button
                onClick={() => signOut()}
                className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl shrink-0 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {isCollapsed && (
            <button
              onClick={() => signOut()}
              className="mt-2 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => {
            if (mode === "expanded") setMode("collapsed");
            else if (mode === "collapsed") setMode("hidden");
          }}
          className={cn(
            "flex items-center justify-center text-slate-500 hover:text-white transition-colors mt-4 mx-auto",
            isCollapsed ? "w-8 h-8" : "w-full gap-2 text-xs py-1"
          )}
          title={isCollapsed ? "Expand Sidebar" : undefined}
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} />
          {!isCollapsed && <span className="font-medium">Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
