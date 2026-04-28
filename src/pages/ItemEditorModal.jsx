import React, { useState, useEffect, useCallback } from "react";
import {
  createItem as createItemAPI,
  updateValue as updateValueAPI,
  fetchCategories,
  deleteCategory as deleteCategoryAPI
} from "./supabaseService";

import { supabase } from "../supabaseClient";
import "./ItemManager.css";
import { v4 as uuidv4 } from "uuid";

export default function ItemEditorModal({
  mode,
  activeItem,
  listingId,
  onClose,
  onRefresh
}) {
  const [itemTitle, setItemTitle] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryValues, setCategoryValues] = useState({});
  const [locks, setLocks] = useState({});
  const [dirtyValues, setDirtyValues] = useState({});
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

  // ---------------- LOAD CATEGORIES ----------------
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories(
        listingId,
        mode === "edit" ? activeItem?.id : null
      );

      setCategories(cats);

      const values = {};
      const lockState = {};

      cats.forEach((cat) => {
        const existingValue =
          activeItem?.item_values?.find(
            (iv) => iv.category_id === cat.id
          )?.value || "";

        values[cat.id] = existingValue;
        lockState[cat.id] = true;
      });

      setCategoryValues(values);
      setLocks(lockState);
      setDirtyValues({});
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [mode, activeItem, listingId]);

  // ---------------- INIT ----------------
  useEffect(() => {
    if (mode === "create") {
      setItemTitle("");
      setCategoryValues({});
      setLocks({});
      setDirtyValues({});
    } else {
      setItemTitle(activeItem?.title || "");
    }

    loadCategories();
  }, [mode, activeItem, loadCategories]);

  // ---------------- TRACK INPUT ----------------
  const handleChange = (catId, value) => {
    setCategoryValues((prev) => ({
      ...prev,
      [catId]: value
    }));

    setDirtyValues((prev) => ({
      ...prev,
      [catId]: true
    }));
  };

  // ---------------- CREATE ITEM ----------------
  const handleCreateItem = async () => {
    if (!itemTitle.trim()) return;

    try {
      const valuesToSave = {};

      categories.forEach((cat) => {
        if (categoryValues[cat.id]?.trim()) {
          valuesToSave[cat.id] = categoryValues[cat.id];
        }
      });

      await createItemAPI(
        itemTitle,
        categories,
        listingId,
        valuesToSave
      );

      onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to create item:", err);
    }
  };

  // ---------------- SAVE EDITS (FIXED DELETE LOGIC) ----------------
  const handleSaveChanges = async () => {
    try {
      const updates = Object.keys(dirtyValues);

      for (const catId of updates) {
        const value = categoryValues[catId];
        const existing = activeItem?.item_values?.find(
          (iv) => iv.category_id === catId
        );

        // 🔴 EMPTY VALUE → DELETE FROM DB
        if (!value || !value.trim()) {
          if (existing) {
            await supabase
              .from("item_values")
              .delete()
              .eq("id", existing.id);
          }
          continue;
        }

        // 🟢 UPDATE EXISTING VALUE
        if (existing) {
          await updateValueAPI(existing.id, value);
        }

        // 🟢 INSERT NEW VALUE
        else {
          await supabase.from("item_values").insert([
            {
              id: uuidv4(),
              item_id: activeItem.id,
              category_id: catId,
              value
            }
          ]);
        }
      }

      setDirtyValues({});
      onRefresh();
      onClose();

    } catch (err) {
      console.error("Failed to save changes:", err);
    }
  };

  // ---------------- DELETE CATEGORY ----------------
  const handleDeleteCategory = async (cat) => {
    if (!window.confirm("Delete category?")) return;

    try {
      await deleteCategoryAPI(cat.id);
      await loadCategories();
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- ADD CATEGORY ----------------
  const addCategory = async () => {
    if (!newCategoryTitle.trim()) return;

    const { data, error } = await supabase
      .from("categories")
      .insert({
        id: uuidv4(),
        title: newCategoryTitle,
        listing_uuid: listingId,
        is_global: mode === "create"
      })
      .select()
      .single();

    if (error) return console.error(error);

    setCategories((prev) => [...prev, data]);
    setLocks((prev) => ({ ...prev, [data.id]: true }));
    setNewCategoryTitle("");
    onRefresh();
  };

  if (!mode) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {mode === "create"
            ? "Add New Item"
            : `Editing: ${activeItem?.title}`}
        </h2>

        {/* ITEM TITLE */}
        <div className="category-input-row">
          <label>Item Name</label>
          <input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            className="input"
          />
        </div>

        <hr />

        {/* CATEGORY FIELDS */}
        <div className="category-inputs">
          {categories.map((cat) => {
            const locked = locks[cat.id];

            return (
              <div key={cat.id} className="category-input-row">
                <label>{cat.title}</label>

                <input
                  type="text"
                  value={categoryValues[cat.id] || ""}
                  readOnly={locked}
                  className="input"
                  onChange={(e) =>
                    handleChange(cat.id, e.target.value)
                  }
                />

                {/* LOCK */}
                <button
                  className="btn-lock"
                  onClick={() =>
                    setLocks((prev) => ({
                      ...prev,
                      [cat.id]: !prev[cat.id]
                    }))
                  }
                >
                  {locked ? "🔒" : "🔓"}
                </button>

                {/* DELETE CATEGORY */}
                {mode === "edit" && !cat.is_global && (
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteCategory(cat)}
                  >
                    X
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ADD CATEGORY */}
        <div className="add-category-row">
          <input
            value={newCategoryTitle}
            onChange={(e) => setNewCategoryTitle(e.target.value)}
            className="input"
            placeholder="New category"
          />
          <button className="btn" onClick={addCategory}>
            Add
          </button>
        </div>

        {/* ACTIONS */}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>

          {mode === "create" && (
            <button className="btn-primary" onClick={handleCreateItem}>
              Create Item
            </button>
          )}

          {mode === "edit" && (
            <button className="btn-primary" onClick={handleSaveChanges}>
              Save Changes
            </button>
          )}
        </div>

      </div>
    </div>
  );
}