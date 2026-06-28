import { useState } from "react";
import { ProviderManager } from "./llm/ProviderManager";
import { ProviderMarketplace } from "./llm/ProviderMarketplace";
import { ToolBindings } from "./llm/ToolBindings";

type TabKey = "marketplace" | "providers" | "bindings";

function ProvidersIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function MarketplaceIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function BindingsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "providers", label: "模型列表", icon: <ProvidersIcon size={15} /> },
  { key: "marketplace", label: "模型市场", icon: <MarketplaceIcon size={15} /> },
  { key: "bindings", label: "工具绑定", icon: <BindingsIcon size={15} /> },
];

export function LlmModel() {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}
    >
      <div
        style={{
          padding: "24px 24px 0",
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--foreground)",
            margin: "0 0 16px",
          }}
        >
          大模型
        </h1>

        {/* Tab bar — icon + text, no capsule border, full-width divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 24px",
            margin: "0 -24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {TABS.map(({ key, label, icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "color 0.15s ease, background-color 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--foreground) 6%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <span style={{ opacity: active ? 1 : 0.5, display: "inline-flex", transition: "opacity 0.15s" }}>
                  {icon}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px 24px",
        }}
      >
        {activeTab === "marketplace" && <ProviderMarketplace />}
        {activeTab === "providers" && <ProviderManager />}
        {activeTab === "bindings" && <ToolBindings />}
      </div>
    </div>
  );
}
