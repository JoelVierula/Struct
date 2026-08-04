import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { updateCategoryTitle } from "./supabaseService";

export const CATEGORY_TYPE_OPTIONS = [
  { label: "Propio", value: "own" },
  { label: "Fecha", value: "date" },
  { label: "Horario", value: "schedule" },
  { label: "Cliente potencial", value: "lead" }
];

const LEAD_OPTIONS = [
  "Conectado",
  "Rechazado",
  "Contacto",
  "Seguimiento 1",
  "Seguimiento 2",
  "Seguimiento 3"
];

export function CategoryField({
  cat,
  mode,
  value,
  locked,
  onChange,
  onRefresh,
  onDelete
}) {
  const [openTypeMenu, setOpenTypeMenu] = useState(false);
  const [openLeadMenu, setOpenLeadMenu] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(cat.title);

  // Keep the draft in sync if the category title changes externally (e.g. after refresh)
  useEffect(() => {
    setTitleDraft(cat.title);
  }, [cat.title]);

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
    onRefresh?.();
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

    return (
      <input
        type="text"
        value={value || ""}
        readOnly={locked}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    );
  };

  return (
    <div className="category-input-row">

      {/* LABEL */}
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
          <label>{cat.title}</label>
        )}

        {/* RENAME BUTTON — only when editable AND lock is open */}
        {canRename && !editingTitle && (
          <button
            className="btn-rename"
            onClick={() => setEditingTitle(true)}
            title="Renombrar categoría"
          >
            ✏️
          </button>
        )}

        {/* DELETE BUTTON — create mode for all, edit mode for local only */}
        {(mode === "create" || (mode === "edit" && !cat.is_global)) && (
          <button className="btn-delete" onClick={onDelete}>
            🗑
          </button>
        )}

        {/* ONLY SHOW ARROW IF EDITABLE */}
        {canEditType && (
          <button
            className="type-arrow"
            onClick={() => setOpenTypeMenu(prev => !prev)}
          >
            ⬇
          </button>
        )}

        {/* ONLY SHOW DROPDOWN IF EDITABLE */}
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

      {/* INPUT */}
      {renderInput()}

    </div>
  );
}