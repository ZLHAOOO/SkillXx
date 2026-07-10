import { useState } from "react";
import { Plus } from "lucide-react";
import providerDirectory from "@/data/providerDirectory.json";
import { getProviderInitial } from "@/utils/providerIcon";
import { getProviderSvgContent } from "@/utils/providerLogoSvg";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ProviderAddModal } from "./ProviderAddModal";

interface ProviderDirectoryEntry {
  id: string;
  name: string;
  base_url_openai: string;
  base_url_anthropic: string;
  model: string;
  website_url: string;
  icon: string;
}

// Providers whose SVG uses `fill="currentColor"` and therefore needs
// explicit theme-aware coloring.
const CURRENT_COLOR_PROVIDERS = new Set([
  "openai", "gpt", "chatgpt",
  "glm", "智谱", "bigmodel",
  "kimi", "moonshot",
  "grok", "x.ai",
  "openrouter",
  "groq",
  "zai", "z.ai",
]);

function providerNeedsCurrentColor(name: string, id?: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();
  for (const kw of CURRENT_COLOR_PROVIDERS) {
    if (lowerName.includes(kw) || lowerId.includes(kw)) return true;
  }
  return false;
}

function ProviderMarketplaceCard({
  entry,
  onAddClick,
}: {
  entry: ProviderDirectoryEntry;
  onAddClick: (entry: ProviderDirectoryEntry) => void;
}) {
  const svgContent = getProviderSvgContent(entry.name, entry.id);
  const colorScheme = useColorScheme();
  const needsTint = providerNeedsCurrentColor(entry.name, entry.id);

  const iconColor = needsTint
    ? colorScheme === "dark"
      ? "#FFFFFF"
      : "#1a1a1a"
    : "inherit";

  return (
    <div
      style={{
        borderRadius: "10px",
        border: "1px solid var(--border)",
        backgroundColor: "var(--secondary)",
        padding: "16px",
        position: "relative",
      }}
    >
      {/* 右上角操作按钮 */}
      <div style={{ position: "absolute", top: "12px", right: "12px" }}>
        <button
          onClick={() => onAddClick(entry)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "6px",
            backgroundColor: "var(--muted)",
            color: "var(--muted-foreground)",
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", paddingRight: "36px" }}>
        {svgContent ? (
          <div
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{
              width: 40,
              height: 40,
              borderRadius: "6px",
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "6px",
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getProviderInitial(entry.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "4px" }}>
            {entry.name}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--muted-foreground)",
              lineHeight: 1.6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.website_url}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProviderMarketplace() {
  const [selectedEntry, setSelectedEntry] = useState<ProviderDirectoryEntry | null>(null);

  const handleAddClick = (entry: ProviderDirectoryEntry) => {
    setSelectedEntry(entry);
  };

  const handleCustomClick = () => {
    setSelectedEntry({
      id: "__custom__",
      name: "",
      base_url_openai: "",
      base_url_anthropic: "",
      model: "",
      website_url: "",
      icon: "",
    } as ProviderDirectoryEntry);
  };

  const handleModalSaved = () => {
    setSelectedEntry(null);
  };

  const handleModalClose = () => {
    setSelectedEntry(null);
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {/* 自定义模型卡片 */}
        <div
          onClick={handleCustomClick}
          style={{
            borderRadius: "10px",
            border: "2px dashed var(--border)",
            backgroundColor: "transparent",
            padding: "16px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "border-color 0.15s, backgroundColor 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 5%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Plus style={{ width: "20px", height: "20px" }} />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted-foreground)" }}>
            自定义模型
          </span>
        </div>

        {providerDirectory.map((entry) => (
          <ProviderMarketplaceCard
            key={entry.id}
            entry={entry}
            onAddClick={handleAddClick}
          />
        ))}
      </div>

      <ProviderAddModal entry={selectedEntry} onClose={handleModalClose} onSaved={handleModalSaved} />
    </div>
  );
}
