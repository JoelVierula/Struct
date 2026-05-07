import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export const CATEGORY_TYPE_OPTIONS = [
  { label: "Own", value: "own" },
  { label: "Date", value: "date" },
  { label: "Lead", value: "lead" }
];

const LEAD_OPTIONS = [
  "Connected",
  "Rejected",
  "Contact",
  "Follow up 1",
  "Follow up 2",
  "Follow up 3"
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

    if (cat.type === "lead") {
      return (
        <div className="lead-selector">
          <button
            className="lead-choose-btn"
            disabled={locked}
            onClick={() => !locked && setOpenLeadMenu(prev => !prev)}
          >
            {value || "Choose"}
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
        <label>
          {cat.title} {cat.type === "date" && "📅"} {cat.type === "lead" && "🎯"}
        </label>

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