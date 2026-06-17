import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarMode = "expanded" | "collapsed" | "hidden";

interface SidebarState {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
  toggleCollapse: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      mode: "expanded",
      setMode: (mode) => set({ mode }),
      toggleCollapse: () => {
        const current = get().mode;
        if (current === "expanded") set({ mode: "collapsed" });
        else if (current === "collapsed") set({ mode: "hidden" });
        else set({ mode: "expanded" });
      },
    }),
    { name: "sentinel-sidebar" }
  )
);
