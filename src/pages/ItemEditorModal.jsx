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
  const [titleLocked, setTitleLocked] = useState(true);

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
      setTitleLocked(false);
      setCategoryValues({});
      setLocks({});
      setDirtyValues({});
    } else {
      setItemTitle(activeItem?.title || "");
      setTitleLocked(true);
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
        ? "Delete this category?\n\nThis will DELETE all items that contain this category."
        : "Delete this local category?\n\nThis will remove it from this item."
    );

    if (!confirmDelete) return;

    try {
      if (cat.is_global) {
        const { data: itemValues, error } = await supabase
          .from("item_values")
          .select("item_id")
          .eq("category_id", cat.id);

        if (error) throw error;

        const itemIds = [...new Set(itemValues.map(v => v.item_id))];

        if (itemIds.length > 0) {
          const { deleteItems } = await import("./supabaseService");
          await deleteItems(itemIds);
        }
      } else {
        // Local category — just delete item_values and the category itself
        await supabase
          .from("item_values")
          .delete()
          .eq("category_id", cat.id);
      }

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

    // In edit mode, link the new local category to the item immediately
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
    setLocks((prev) => ({ ...prev, [data.id]: false }));
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
            readOnly={titleLocked}
            onChange={(e) => setItemTitle(e.target.value)}
            className="input"
          />

          {mode === "edit" && (
            <button
              className="btn-lock"
              onClick={() => setTitleLocked(prev => !prev)}
            >
              {titleLocked ? "🔒" : "🔓"}
            </button>
          )}
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
              locked={locks[cat.id]}
              onChange={(val) => handleChange(cat.id, val)}
              onToggleLock={() =>
                setLocks((prev) => ({
                  ...prev,
                  [cat.id]: !prev[cat.id]
                }))
              }
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