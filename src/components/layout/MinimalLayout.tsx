import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function MinimalLayout() {
  return (
    <div className="flex h-screen relative" style={{ backgroundColor: "var(--secondary)" }}>
      <Sidebar />
      <main
        className="flex-1 overflow-auto relative"
        style={{
          margin: "8px 8px 8px 0",
          backgroundColor: "var(--background)",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
