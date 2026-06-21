import { useState } from "react";
import { ProviderManager } from "./llm/ProviderManager";
import { ToolBindings } from "./llm/ToolBindings";

type TabKey = "providers" | "bindings";

export function LlmModel() {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
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

        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            gap: "0",
          }}
        >
          <button
            onClick={() => setActiveTab("providers")}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 500,
              border: "none",
              borderBottom: activeTab === "providers" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "providers" ? "var(--foreground)" : "var(--muted-foreground)",
              backgroundColor: "transparent",
              cursor: "pointer",
              marginBottom: "-1px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            供应商
          </button>
          <button
            onClick={() => setActiveTab("bindings")}
            style={{
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 500,
              border: "none",
              borderBottom: activeTab === "bindings" ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === "bindings" ? "var(--foreground)" : "var(--muted-foreground)",
              backgroundColor: "transparent",
              cursor: "pointer",
              marginBottom: "-1px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            工具绑定
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px 24px",
        }}
      >
        {activeTab === "providers" && <ProviderManager />}
        {activeTab === "bindings" && <ToolBindings />}
      </div>
    </div>
  );
}
