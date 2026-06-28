import { useState } from "react";
import { X, Plus, Trash2, ChevronRight, Check } from "lucide-react";
import type { AppConfig } from "@/types";
import type { TranslationPath } from "@/i18n";
import { DEFAULT_DIMENSIONS } from "@/constants/categories";

interface CategoryEditDialogProps {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onSave: (config: AppConfig) => Promise<void>;
  t: (key: TranslationPath) => string;
}

export function CategoryEditDialog({
  open,
  config,
  onClose,
  onSave,
  t,
}: CategoryEditDialogProps) {
  const dimensions = config?.skill_category_dimensions?.length
    ? config.skill_category_dimensions
    : DEFAULT_DIMENSIONS;

  const [selectedDimId, setSelectedDimId] = useState<string>(
    dimensions[0]?.id ?? "scene"
  );
  const [newDimensionName, setNewDimensionName] = useState("");
  const [showNewDimension, setShowNewDimension] = useState(false);
  const [newValueDraft, setNewValueDraft] = useState("");
  const [editingValue, setEditingValue] = useState<{ dimId: string; index: number; value: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "dimension" | "value"; name: string; dimId: string; valueIndex?: number } | null>(null);

  const selectedDimension = dimensions.find((d) => d.id === selectedDimId);

  if (!open) return null;

  const handleAddDimension = () => {
    const name = newDimensionName.trim();
    if (!name) return;
    const id = `dim_${Date.now()}`;
    const nextDimensions = [...dimensions, { id, label: name, values: [] }];
    onSave({
      ...config,
      skill_category_dimensions: nextDimensions,
    });
    setNewDimensionName("");
    setShowNewDimension(false);
    setSelectedDimId(id);
  };

  const handleDeleteDimension = (dimId: string, _dimLabel: string) => {
    const nextDimensions = dimensions.filter((d) => d.id !== dimId);
    onSave({
      ...config,
      skill_category_dimensions: nextDimensions,
    });
    if (selectedDimId === dimId) {
      setSelectedDimId(nextDimensions[0]?.id ?? "");
    }
    setDeleteConfirm(null);
  };

  const handleAddValue = (dimId: string) => {
    const value = newValueDraft.trim();
    if (!value) return;
    const nextDimensions = dimensions.map((d) => {
      if (d.id === dimId) {
        return { ...d, values: [...d.values, value] };
      }
      return d;
    });
    onSave({
      ...config,
      skill_category_dimensions: nextDimensions,
    });
    setNewValueDraft("");
  };

  const handleRenameValue = (dimId: string, index: number, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const nextDimensions = dimensions.map((d) => {
      if (d.id === dimId) {
        const newValues = [...d.values];
        newValues[index] = trimmed;
        return { ...d, values: newValues };
      }
      return d;
    });
    onSave({
      ...config,
      skill_category_dimensions: nextDimensions,
    });
    setEditingValue(null);
  };

  const handleDeleteValue = (dimId: string, index: number) => {
    const nextDimensions = dimensions.map((d) => {
      if (d.id === dimId) {
        return { ...d, values: d.values.filter((_, i) => i !== index) };
      }
      return d;
    });
    onSave({
      ...config,
      skill_category_dimensions: nextDimensions,
    });
    setDeleteConfirm(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        style={{
          position: "relative",
          width: "640px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
              {t("skills.categoryEditTitle")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted-foreground)" }}>
              {t("skills.categoryEditDesc")}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              borderRadius: "8px",
              color: "var(--muted-foreground)",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Body - two columns */}
        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Left: Dimensions list */}
          <div
            style={{
              width: "200px",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {t("skills.categoryDimension")}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
              {dimensions.map((dim) => (
                <div key={dim.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    onClick={() => setSelectedDimId(dim.id)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      fontSize: "13px",
                      fontWeight: selectedDimId === dim.id ? 600 : 400,
                      color: selectedDimId === dim.id ? "var(--foreground)" : "var(--muted-foreground)",
                      backgroundColor: selectedDimId === dim.id ? "var(--secondary)" : "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dim.label}
                    </span>
                    <ChevronRight width={14} height={14} style={{ flexShrink: 0, opacity: 0.5 }} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: "dimension", name: dim.label, dimId: dim.id })}
                    style={{
                      padding: "4px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      color: "var(--muted-foreground)",
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "var(--destructive)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.color = "var(--muted-foreground)";
                    }}
                  >
                    <Trash2 width={14} height={14} />
                  </button>
                </div>
              ))}

              {/* Add dimension */}
              {showNewDimension ? (
                <div style={{ display: "flex", gap: "4px", padding: "4px" }}>
                  <input
                    autoFocus
                    value={newDimensionName}
                    onChange={(e) => setNewDimensionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddDimension();
                      if (e.key === "Escape") setShowNewDimension(false);
                    }}
                    placeholder="维度名称"
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      fontSize: "12px",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleAddDimension}
                    style={{
                      padding: "6px",
                      border: "none",
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Check width={14} height={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewDimension(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--muted-foreground)",
                    backgroundColor: "transparent",
                    border: "1px dashed var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginTop: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.borderColor = "var(--ring)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <Plus width={14} height={14} />
                  {t("skills.categoryAddDimension")}
                </button>
              )}
            </div>
          </div>

          {/* Right: Values of selected dimension */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {t("skills.categoryValues")} — {selectedDimension?.label}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
              {selectedDimension?.values.map((val, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "6px",
                  }}
                >
                  {editingValue?.dimId === selectedDimId && editingValue?.index === index ? (
                    <input
                      autoFocus
                      value={editingValue.value}
                      onChange={(e) =>
                        setEditingValue({ ...editingValue, value: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRenameValue(selectedDimId, index, editingValue.value);
                        }
                        if (e.key === "Escape") setEditingValue(null);
                      }}
                      onBlur={() => {
                        if (editingValue?.value.trim()) {
                          handleRenameValue(selectedDimId, index, editingValue.value);
                        } else {
                          setEditingValue(null);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: "13px",
                        border: "1px solid var(--ring)",
                        borderRadius: "6px",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <button
                      onClick={() =>
                        setEditingValue({ dimId: selectedDimId, index, value: val })
                      }
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        fontSize: "13px",
                        color: "var(--foreground)",
                        backgroundColor: "var(--secondary)",
                        border: "1px solid transparent",
                        borderRadius: "8px",
                        cursor: "text",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      {val}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setDeleteConfirm({
                        type: "value",
                        name: val,
                        dimId: selectedDimId,
                        valueIndex: index,
                      })
                    }
                    style={{
                      padding: "4px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      borderRadius: "4px",
                      color: "var(--muted-foreground)",
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "var(--destructive)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.color = "var(--muted-foreground)";
                    }}
                  >
                    <Trash2 width={14} height={14} />
                  </button>
                </div>
              ))}

              {/* Add value input */}
              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <input
                  value={newValueDraft}
                  onChange={(e) => setNewValueDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddValue(selectedDimId);
                  }}
                  placeholder={t("skills.categoryAddValue")}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    fontSize: "13px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => handleAddValue(selectedDimId)}
                  disabled={!newValueDraft.trim()}
                  style={{
                    padding: "8px",
                    border: "none",
                    backgroundColor: newValueDraft.trim() ? "var(--primary)" : "var(--muted)",
                    color: "var(--primary-foreground)",
                    borderRadius: "8px",
                    cursor: newValueDraft.trim() ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    opacity: newValueDraft.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus width={16} height={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: "320px",
                padding: "20px",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
              }}
            >
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--foreground)" }}>
                {deleteConfirm.type === "dimension"
                  ? t("skills.categoryDeleteConfirm").replace("{name}", deleteConfirm.name)
                  : t("skills.categoryValueDeleteConfirm").replace("{name}", deleteConfirm.name)}
              </p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--foreground)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirm.type === "dimension") {
                      handleDeleteDimension(deleteConfirm.dimId, deleteConfirm.name);
                    } else if (deleteConfirm.valueIndex !== undefined) {
                      handleDeleteValue(deleteConfirm.dimId, deleteConfirm.valueIndex);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    border: "none",
                    backgroundColor: "var(--destructive)",
                    color: "#fff",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
