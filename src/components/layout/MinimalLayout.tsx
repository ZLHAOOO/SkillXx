import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function MinimalLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen relative">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
      <main
        className="flex-1 overflow-auto relative glass-content"
        style={{
          margin: "8px 8px 8px 0",
          borderRadius: "16px",
        }}
      >
        {/* Invisible drag region at top edge */}
        <div
          onMouseDown={() => getCurrentWindow().startDragging()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            cursor: "grab",
            zIndex: 1,
          }}
        />
        <Outlet />
      </main>
    </div>
  );
}
