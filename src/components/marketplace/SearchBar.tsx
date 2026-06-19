import { useState } from "react";
import skillhubLogo from "@/assets/platforms/SkillHub.png";
import clawhubLogo from "@/assets/platforms/clawd-logo.png";
import skillsShLogo from "@/assets/platforms/skills-sh.svg";
import awesomeSkillsLogo from "@/assets/platforms/awesome-skills.svg";

interface SearchBarProps {
  onSearch: (platform: string, query: string) => void;
  onInstallByUrl: (platform: string, url: string) => void;
  loading: boolean;
}

const platformLogos: Record<string, string> = {
  "skills.sh": skillsShLogo,
  "awesome-claude-skills": awesomeSkillsLogo,
  "skillhub": skillhubLogo,
  "clawhub": clawhubLogo,
};

const platformLabels: Record<string, string> = {
  "skills.sh": "skills.sh",
  "awesome-claude-skills": "awesome-claude-skills",
  "skillhub": "SkillHub",
  "clawhub": "ClawHub",
};

const searchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

const linkIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const formStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: "44px",
  backgroundColor: "var(--background)",
  borderRadius: "22px",
  border: "1px solid var(--border)",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  padding: "3px",
  minWidth: 0,
};


export function SearchBar({ onSearch, onInstallByUrl, loading }: SearchBarProps) {
  const [mode, setMode] = useState<"search" | "link">("search");
  const [platform, setPlatform] = useState<"skills.sh" | "awesome-claude-skills" | "skillhub" | "clawhub">("skills.sh");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(platform, searchQuery.trim());
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl.trim()) {
      onInstallByUrl(platform, linkUrl.trim());
    }
  };

  const handlePlatformSelect = (newPlatform: "skills.sh" | "awesome-claude-skills" | "skillhub" | "clawhub") => {
    setPlatform(newPlatform);
    setShowDropdown(false);
  };

  const toggleMode = () => {
    setShowDropdown(false);
    setMode((prev) => (prev === "search" ? "link" : "search"));
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      maxWidth: "600px",
    }}>
      {/* Search Mode */}
      <div style={{
        flex: mode === "search" ? "1 1 0" : "0 0 44px",
        width: mode === "search" ? "auto" : "44px",
        minWidth: 0,
        height: "48px",
        paddingBottom: "4px",
        boxSizing: "content-box",
        transition: "flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "visible",
      }}>
        {mode === "search" ? (
          <form onSubmit={handleSearchSubmit} style={formStyle}>
            {/* Platform selector */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  height: "32px",
                  padding: "0 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  border: "none",
                  borderRadius: "16px",
                  cursor: "pointer",
                }}
              >
                <img
                  src={platformLogos[platform]}
                  alt={platformLabels[platform]}
                  style={{ width: "16px", height: "16px", borderRadius: "4px", objectFit: "contain" }}
                />
                <span>{platformLabels[platform]}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={showDropdown ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setShowDropdown(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: "150px",
                    backgroundColor: "var(--popover)", border: "1px solid var(--border)",
                    borderRadius: "10px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)", padding: "4px", zIndex: 101,
                  }}>
                    {(["skills.sh", "awesome-claude-skills", "skillhub", "clawhub"] as const).map((p) => (
                      <button key={p} type="button" onClick={() => handlePlatformSelect(p)} style={{
                        display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 10px",
                        fontSize: "12px", fontWeight: platform === p ? 600 : 400,
                        color: platform === p ? {
                          "skills.sh": "#6366f1",
                          "awesome-claude-skills": "#f59e0b",
                          "skillhub": "var(--primary)",
                          "clawhub": "#8b5cf6",
                        }[p] : "var(--foreground)",
                        backgroundColor: platform === p ? {
                          "skills.sh": "rgba(99, 102, 241, 0.1)",
                          "awesome-claude-skills": "rgba(245, 158, 11, 0.1)",
                          "skillhub": "rgba(59, 130, 246, 0.1)",
                          "clawhub": "rgba(139, 92, 246, 0.1)",
                        }[p] : "transparent",
                        border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                      }}>
                        <img src={platformLogos[p]} alt={platformLabels[p]} style={{ width: "20px", height: "20px", borderRadius: "4px", objectFit: "contain" }} />
                        {platformLabels[p]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border)", margin: "0 4px" }} />

            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能..." style={{
                flex: 1, height: "100%", padding: "0 8px", fontSize: "13px",
                color: "var(--foreground)", backgroundColor: "transparent", border: "none", outline: "none",
              }} />

            <button type="submit" disabled={loading || !searchQuery.trim()} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "50%", border: "none",
              backgroundColor: loading || !searchQuery.trim() ? "var(--secondary)" : "var(--primary)",
              color: loading || !searchQuery.trim() ? "var(--muted-foreground)" : "var(--primary-foreground)",
              cursor: loading || !searchQuery.trim() ? "not-allowed" : "pointer", flexShrink: 0,
            }}>
              {loading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : searchIcon}
            </button>
          </form>
        ) : (
          <button onClick={toggleMode} title="搜索技能" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            cursor: "pointer",
            flexShrink: 0,
          }}>
            {searchIcon}
          </button>
        )}
      </div>

      {/* Link Mode */}
      <div style={{
        flex: mode === "link" ? "1 1 0" : "0 0 44px",
        width: mode === "link" ? "auto" : "44px",
        minWidth: 0,
        height: "48px",
        paddingBottom: "4px",
        boxSizing: "content-box",
        transition: "flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}>
        {mode === "link" ? (
          <form onSubmit={handleLinkSubmit} style={formStyle}>
            {/* Label */}
            <div style={{
              width: "90px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)", fontWeight: 500 }}>
                链接安装
              </span>
            </div>

            <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border)", margin: "0 4px" }} />

            <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="粘贴 GitHub 技能仓库链接..." style={{
                flex: 1, height: "100%", padding: "0 8px", fontSize: "13px",
                color: "var(--foreground)", backgroundColor: "transparent", border: "none", outline: "none",
              }} />

            <button type="submit" disabled={loading || !linkUrl.trim()} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "32px", padding: "0 14px", fontSize: "12px", fontWeight: 500,
              borderRadius: "16px", border: "none",
              backgroundColor: loading || !linkUrl.trim() ? "var(--secondary)" : "var(--primary)",
              color: loading || !linkUrl.trim() ? "var(--muted-foreground)" : "var(--primary-foreground)",
              cursor: loading || !linkUrl.trim() ? "not-allowed" : "pointer", flexShrink: 0,
            }}>
              安装
            </button>
          </form>
        ) : (
          <button onClick={toggleMode} title="粘贴链接安装" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            cursor: "pointer",
            flexShrink: 0,
          }}>
            {linkIcon}
          </button>
        )}
      </div>
    </div>
  );
}
