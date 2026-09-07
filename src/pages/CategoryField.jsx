import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { updateCategoryTitle, fetchCategoryOptions, addCategoryOption, deleteCategoryOption } from "./supabaseService";

export const CATEGORY_TYPE_OPTIONS = [
  { label: "Propio", value: "own" },
  { label: "Fecha", value: "date" },
  { label: "Horario", value: "schedule" },
  { label: "Cliente potencial", value: "lead" },
  { label: "Personalizado", value: "custom" }
];

const LEAD_OPTIONS = [
  "Conectado",
  "Rechazado",
  "Contacto",
  "Seguimiento 1",
  "Seguimiento 2",
  "Seguimiento 3"
];

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function CategoryField({
  cat,
  mode,
  value,
  locked,
  onChange,
  onRefresh,
  onDelete
}) {
  const [showButtons, setShowButtons] = useState(false);
  const [openTypeMenu, setOpenTypeMenu] = useState(false);
  const [openLeadMenu, setOpenLeadMenu] = useState(false);
  const [openCustomMenu, setOpenCustomMenu] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(cat.title);

  // Custom type state
  const [customOptions, setCustomOptions] = useState([]);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [showCustomManager, setShowCustomManager] = useState(false);

  const textareaRef = useRef(null);

  // Keep the draft in sync if the category title changes externally
  useEffect(() => {
    setTitleDraft(cat.title);
  }, [cat.title]);

  // Resize whenever value changes (e.g. on load)
  useEffect(() => {
    autoResize(textareaRef.current);
  }, [value]);

  // Load custom options when category type is custom
  useEffect(() => {
    if (cat.type === "custom") {
      loadCustomOptions();
    }
  }, [cat.id, cat.type]);

  const loadCustomOptions = async () => {
    const opts = await fetchCategoryOptions(cat.id);
    setCustomOptions(opts);
  };

  const updateCategoryType = async (newType) => {
    const { error } = await supabase
      .from("categories")
      .update({ type: newType })
      .eq("id", cat.id);

    if (error) {
      console.error(error);
      return;
    }

    setOpenTypeMenu(false);

    if (newType === "custom") {
      setShowCustomManager(true);
      await loadCustomOptions();
    }

    onRefresh?.();
  };

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;

    await addCategoryOption(cat.id, newOptionLabel.trim(), customOptions.length);
    setNewOptionLabel("");
    await loadCustomOptions();
  };

  const handleDeleteOption = async (optionId) => {
    await deleteCategoryOption(optionId);
    await loadCustomOptions();
  };

  const canEditType = mode === "create" || !cat.is_global;
  const canRename = canEditType && !locked;

  const handleRenameSave = async () => {
    const trimmed = titleDraft.trim();

    if (!trimmed || trimmed === cat.title) {
      setTitleDraft(cat.title);
      setEditingTitle(false);
      return;
    }

    try {
      await updateCategoryTitle(cat.id, trimmed);
      setEditingTitle(false);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to rename category:", err);
      setTitleDraft(cat.title);
      setEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSave();
    } else if (e.key === "Escape") {
      setTitleDraft(cat.title);
      setEditingTitle(false);
    }
  };

  const renderInput = () => {
    if (cat.type === "date") {
      return (
        <input
          type="date"
          value={value || ""}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
      );
    }

    if (cat.type === "schedule") {
      return (
        <input
          type="datetime-local"
          value={value || ""}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
      );
    }

    if (cat.type === "lead") {
      return (
        <div className="lead-selector">
          <button
            className="lead-choose-btn"
            disabled={locked}
            onClick={() => !locked && setOpenLeadMenu(prev => !prev)}
          >
            {value || "Elegir"}
          </button>
          {openLeadMenu && !locked && (
            <div className="lead-dropdown">
              {LEAD_OPTIONS.map(opt => (
                <div
                  key={opt}
                  className="lead-option"
                  onClick={() => {
                    onChange(opt);
                    setOpenLeadMenu(false);
                  }}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (cat.type === "custom") {
      return (
        <div className="lead-selector">
          <button
            className="lead-choose-btn"
            disabled={locked}
            onClick={() => !locked && setOpenCustomMenu(prev => !prev)}
          >
            {value || "Elegir"}
          </button>
          {openCustomMenu && !locked && (
            <div className="lead-dropdown">
              {customOptions.length === 0 && (
                <div className="lead-option" style={{ color: "#999", fontStyle: "italic" }}>
                  Sin opciones
                </div>
              )}
              {customOptions.map(opt => (
                <div
                  key={opt.id}
                  className="lead-option"
                  onClick={() => {
                    onChange(opt.label);
                    setOpenCustomMenu(false);
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // "own" type — auto-resizing textarea
    return (
      <textarea
        ref={textareaRef}
        value={value || ""}
        readOnly={locked}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize(e.target);
        }}
        className="input auto-textarea"
      />
    );
  };

  const hasAnyButton =
    (canRename && !editingTitle) ||
    (mode === "create" || (mode === "edit" && !cat.is_global)) ||
    canEditType ||
    (cat.type === "custom" && canEditType && !locked);

  return (
    <div className="category-input-row">

      {/* LABEL + BUTTONS stacked vertically */}
      <div className="category-header">
        {editingTitle ? (
          <input
            autoFocus
            className="input category-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleRenameSave}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <div className="category-label-row">
            <label>{cat.title}</label>

            {/* Single toggle button — only shown when there are actions available */}
            {hasAnyButton && (
              <button
                className="btn-toggle-actions"
                onClick={() => setShowButtons(prev => !prev)}
                title="Opciones"
              >
                {showButtons ? "✕" : "⋯"}
              </button>
            )}
          </div>
        )}

        {/* Action buttons — shown only when toggled */}
        {showButtons && !editingTitle && (
          <div className="category-header-buttons">
            {canRename && (
              <button
                className="btn-rename"
                onClick={() => { setEditingTitle(true); setShowButtons(false); }}
                title="Renombrar categoría"
              >
                ✏️
              </button>
            )}

            {(mode === "create" || (mode === "edit" && !cat.is_global)) && (
              <button className="btn-delete" onClick={onDelete}>
                🗑
              </button>
            )}

            {canEditType && (
              <button
                className="type-arrow"
                onClick={() => setOpenTypeMenu(prev => !prev)}
              >
                ⬇
              </button>
            )}

            {cat.type === "custom" && canEditType && !locked && (
              <button
                className="btn"
                style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                onClick={() => setShowCustomManager(prev => !prev)}
                title="Administrar opciones"
              >
                ⚙️
              </button>
            )}
          </div>
        )}

        {openTypeMenu && canEditType && (
          <div className="type-dropdown">
            {CATEGORY_TYPE_OPTIONS.map(opt => (
              <div
                key={opt.value}
                className="type-option"
                onClick={() => updateCategoryType(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CUSTOM OPTIONS MANAGER */}
      {cat.type === "custom" && showCustomManager && canEditType && (
        <div className="custom-options-manager">
          <div className="custom-options-list">
            {customOptions.length === 0 && (
              <span style={{ color: "#999", fontSize: "0.85rem", fontStyle: "italic" }}>
                Sin opciones aún
              </span>
            )}
            {customOptions.map(opt => (
              <div key={opt.id} className="custom-option-row">
                <span>{opt.label}</span>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteOption(opt.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="custom-option-add-row">
            <input
              className="input"
              placeholder="Nueva opción..."
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); }}}
            />
            <button className="btn" onClick={handleAddOption}>+</button>
          </div>
        </div>
      )}

      {/* INPUT */}
      {renderInput()}

    </div>
  );
}