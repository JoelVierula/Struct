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

import { CategoryField } from "./CategoryField";

export default function ItemEditorModal({
  mode,
  activeItem,
  listingId,
  onClose,
  onRefresh
}) {
  const [itemTitle, setItemTitle] = useState("");
  const [globalLocked, setGlobalLocked] = useState(true);

  const [categories, setCategories] = useState([]);
  const [categoryValues, setCategoryValues] = useState({});
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

      cats.forEach((cat) => {
        const existingValue =
          activeItem?.item_values?.find(
            (iv) => iv.category_id === cat.id
          )?.value || "";

        values[cat.id] = existingValue;
      });

      setCategoryValues(values);
      setDirtyValues({});
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [mode, activeItem, listingId]);

  // ---------------- INIT ----------------
  useEffect(() => {
    if (mode === "create") {
      setItemTitle("");
      setGlobalLocked(false);
      setCategoryValues({});
      setDirtyValues({});
    } else {
      setItemTitle(activeItem?.title || "");
      setGlobalLocked(true);
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

  // ---------------- SAVE EDITS ----------------
  const handleSaveChanges = async () => {
    try {
      if (itemTitle.trim() && itemTitle !== activeItem.title) {
        await supabase
          .from("items")
          .update({ title: itemTitle })
          .eq("id", activeItem.id);
      }

      const updates = Object.keys(dirtyValues);

      for (const catId of updates) {
        const value = categoryValues[catId];

        const existing = activeItem?.item_values?.find(
          (iv) => iv.category_id === catId
        );

        if (!value || !value.trim()) {
          if (existing) {
            await supabase
              .from("item_values")
              .delete()
              .eq("id", existing.id);
          }
          continue;
        }

        if (existing) {
          await updateValueAPI(existing.id, value);
        } else {
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
    const confirmDelete = window.confirm(
      cat.is_global
        ? "Delete this category?\n\nThis will remove it and its values from all items."
        : "Delete this local category?\n\nThis will remove it from this item."
    );

    if (!confirmDelete) return;

    try {
      await supabase
        .from("item_values")
        .delete()
        .eq("category_id", cat.id);

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

    if (mode === "edit" && activeItem?.id) {
      const { error: linkError } = await supabase
        .from("item_values")
        .insert({
          id: uuidv4(),
          item_id: activeItem.id,
          category_id: data.id,
          value: ""
        });

      if (linkError) console.error(linkError);
    }

    setCategories((prev) => [...prev, data]);
    setCategoryValues((prev) => ({ ...prev, [data.id]: "" }));
    setNewCategoryTitle("");
    onRefresh();
  };

  if (!mode) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">

        {/* HEADER with global lock */}
        <div className="modal-header">
          <h2>
            {mode === "create"
              ? "Add New Item"
              : `Editing: ${activeItem?.title}`}
          </h2>
          <button
            className="btn-lock"
            onClick={() => setGlobalLocked(prev => !prev)}
          >
            {globalLocked ? "🔒" : "🔓"}
          </button>
        </div>

        {/* ITEM TITLE */}
        <div className="category-input-row">
          <label>Item Name</label>
          <input
            value={itemTitle}
            readOnly={globalLocked}
            onChange={(e) => setItemTitle(e.target.value)}
            className="input"
          />
        </div>

        <hr />

        {/* CATEGORY FIELDS */}
        <div className="category-inputs">
          {categories.map((cat) => (
            <CategoryField
              key={cat.id}
              cat={cat}
              mode={mode}
              value={categoryValues[cat.id]}
              locked={globalLocked}
              onChange={(val) => handleChange(cat.id, val)}
              onRefresh={loadCategories}
              onDelete={() => handleDeleteCategory(cat)}
            />
          ))}
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