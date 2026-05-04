import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export const CATEGORY_TYPE_OPTIONS = [
  { label: "Own", value: "own" },
  { label: "Date", value: "date" }
];

export function CategoryField({
  cat,
  mode,
  value,
  locked,
  onChange,
  onToggleLock,
  onRefresh
}) {
  const [openTypeMenu, setOpenTypeMenu] = useState(false);

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

  // only allow editing in create mode OR non-global in edit mode
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
          {cat.title} {cat.type === "date" && "📅"}
        </label>

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

      {/* LOCK */}
      <button className="btn-lock" onClick={onToggleLock}>
        {locked ? "🔒" : "🔓"}
      </button>

    </div>
  );
}