import { useState } from "react";
import skillhubLogo from "@/assets/platforms/SkillHub.png";
import clawhubLogo from "@/assets/platforms/clawd-logo.png";

interface SearchBarProps {
  onSearch: (platform: string, query: string) => void;
  onInstallByUrl: (platform: string, url: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, onInstallByUrl, loading }: SearchBarProps) {
  const [mode, setMode] = useState<"search" | "link">("search");
  const [platform, setPlatform] = useState<"skillhub" | "clawhub">("skillhub");
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

  const handlePlatformSelect = (newPlatform: "skillhub" | "clawhub") => {
    setPlatform(newPlatform);
    setShowDropdown(false);
  };

  const toggleMode = () => {
    setMode(mode === "search" ? "link" : "search");
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      width: "100%",
      maxWidth: "600px",
    }}>
      {/* Search Mode */}
      <div style={{
        flex: mode === "search" ? 1 : 0,
        width: mode === "search" ? "auto" : "44px",
        height: "44px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}>
        {mode === "search" ? (
          <form onSubmit={handleSearchSubmit} style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "44px",
            backgroundColor: "var(--background)",
            borderRadius: "26px",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            padding: "4px",
          }}>
            {/* Platform selector */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "36px",
                  padding: "0 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  border: "none",
                  borderRadius: "18px",
                  cursor: "pointer",
                }}
              >
                <img
                  src={platform === "skillhub" ? skillhubLogo : clawhubLogo}
                  alt={platform === "skillhub" ? "SkillHub" : "ClawHub"}
                  style={{ width: "18px", height: "18px", borderRadius: "4px", objectFit: "contain" }}
                />
                <span>{platform === "skillhub" ? "SkillHub" : "ClawHub"}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={showDropdown ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setShowDropdown(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "140px",
                    backgroundColor: "var(--popover)", border: "1px solid var(--border)",
                    borderRadius: "10px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)", padding: "4px", zIndex: 101,
                  }}>
                    <button type="button" onClick={() => handlePlatformSelect("skillhub")} style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 10px",
                      fontSize: "12px", fontWeight: platform === "skillhub" ? 600 : 400,
                      color: platform === "skillhub" ? "var(--primary)" : "var(--foreground)",
                      backgroundColor: platform === "skillhub" ? "rgba(59, 130, 246, 0.1)" : "transparent",
                      border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                    }}>
                      <img src={skillhubLogo} alt="SkillHub" style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "contain" }} />
                      SkillHub
                    </button>
                    <button type="button" onClick={() => handlePlatformSelect("clawhub")} style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 10px",
                      fontSize: "12px", fontWeight: platform === "clawhub" ? 600 : 400,
                      color: platform === "clawhub" ? "#8b5cf6" : "var(--foreground)",
                      backgroundColor: platform === "clawhub" ? "rgba(139, 92, 246, 0.1)" : "transparent",
                      border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                    }}>
                      <img src={clawhubLogo} alt="ClawHub" style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "contain" }} />
                      ClawHub
                    </button>
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
              width: "36px", height: "36px", borderRadius: "50%", border: "none",
              backgroundColor: loading || !searchQuery.trim() ? "var(--secondary)" : "var(--primary)",
              color: loading || !searchQuery.trim() ? "var(--muted-foreground)" : "var(--primary-foreground)",
              cursor: loading || !searchQuery.trim() ? "not-allowed" : "pointer", flexShrink: 0,
            }}>
              {loading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              )}
            </button>
          </form>
        ) : (
          <button onClick={toggleMode} title="切换到链接粘贴" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "44px", height: "44px", borderRadius: "50%",
            backgroundColor: "var(--secondary)", border: "1px solid var(--border)",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        )}
      </div>

      {/* Link Mode */}
      <div style={{
        flex: mode === "link" ? 1 : 0,
        width: mode === "link" ? "auto" : "44px",
        height: "44px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}>
        {mode === "link" ? (
          <form onSubmit={handleLinkSubmit} style={{
            display: "flex", alignItems: "center", width: "100%", height: "44px",
            backgroundColor: "var(--background)", borderRadius: "26px",
            border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)", padding: "4px",
          }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button type="button" onClick={() => setShowDropdown(!showDropdown)} style={{
                display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 10px",
                fontSize: "12px", fontWeight: 500, color: "var(--foreground)", backgroundColor: "var(--secondary)",
                border: "none", borderRadius: "18px", cursor: "pointer",
              }}>
                <img src={platform === "skillhub" ? skillhubLogo : clawhubLogo} alt=""
                  style={{ width: "18px", height: "18px", borderRadius: "4px", objectFit: "contain" }} />
                <span>{platform === "skillhub" ? "SkillHub" : "ClawHub"}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={showDropdown ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setShowDropdown(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "140px",
                    backgroundColor: "var(--popover)", border: "1px solid var(--border)",
                    borderRadius: "10px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)", padding: "4px", zIndex: 101,
                  }}>
                    <button type="button" onClick={() => handlePlatformSelect("skillhub")} style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 10px",
                      fontSize: "12px", fontWeight: platform === "skillhub" ? 600 : 400,
                      color: platform === "skillhub" ? "var(--primary)" : "var(--foreground)",
                      backgroundColor: platform === "skillhub" ? "rgba(59, 130, 246, 0.1)" : "transparent",
                      border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                    }}>
                      <img src={skillhubLogo} alt="SkillHub" style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "contain" }} />
                      SkillHub
                    </button>
                    <button type="button" onClick={() => handlePlatformSelect("clawhub")} style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 10px",
                      fontSize: "12px", fontWeight: platform === "clawhub" ? 600 : 400,
                      color: platform === "clawhub" ? "#8b5cf6" : "var(--foreground)",
                      backgroundColor: platform === "clawhub" ? "rgba(139, 92, 246, 0.1)" : "transparent",
                      border: "none", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                    }}>
                      <img src={clawhubLogo} alt="ClawHub" style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "contain" }} />
                      ClawHub
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border)", margin: "0 4px" }} />

            <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="粘贴技能链接..." style={{
                flex: 1, height: "100%", padding: "0 8px", fontSize: "13px",
                color: "var(--foreground)", backgroundColor: "transparent", border: "none", outline: "none",
              }} />

            <button type="submit" disabled={loading || !linkUrl.trim()} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "36px", padding: "0 14px", fontSize: "12px", fontWeight: 500,
              borderRadius: "18px", border: "none",
              backgroundColor: loading || !linkUrl.trim() ? "var(--secondary)" : "var(--primary)",
              color: loading || !linkUrl.trim() ? "var(--muted-foreground)" : "var(--primary-foreground)",
              cursor: loading || !linkUrl.trim() ? "not-allowed" : "pointer", flexShrink: 0,
            }}>
              安装
            </button>
          </form>
        ) : (
          <button onClick={toggleMode} title="切换到搜索" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "44px", height: "44px", borderRadius: "50%",
            backgroundColor: "var(--secondary)", border: "1px solid var(--border)",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
