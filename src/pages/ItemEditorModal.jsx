import React, { useState, useEffect, useCallback } from "react";
import { 
  createItem as createItemAPI, 
  addCategory as addCategoryAPI,
  updateValue as updateValueAPI,
  fetchCategories,
  deleteCategory as deleteCategoryAPI
} from "./supabaseService";
import { supabase } from '../supabaseClient'; 
import { createEvent } from './CalendarService.js'; 
import './ItemManager.css';
import { v4 as uuidv4 } from "uuid";

export default function ItemEditorModal({
  mode,
  activeItem,
  listingId,
  onClose,
  onRefresh
}) {
  const [itemTitle, setItemTitle] = useState("");
  const [categoryValues, setCategoryValues] = useState({});
  const [categories, setCategories] = useState([]);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [locks, setLocks] = useState({});

  // ---------------- LOAD CATEGORIES ----------------
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories(
        listingId,
        mode === "edit" ? activeItem?.id : null
      );

      setCategories(cats);

      const newValues = {};
      const newLocks = {};

      cats.forEach(cat => {
        const val =
          activeItem?.item_values?.find(iv => iv.category_id === cat.id)?.value || "";

        newValues[cat.id] = val;
        newLocks[cat.id] = true;
      });

      // ✅ CLEAN RESET (no merging with old state)
      setCategoryValues(newValues);
      setLocks(newLocks);

    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [mode, activeItem, listingId]);

  // ---------------- INIT / RESET ----------------
  useEffect(() => {
    if (mode === "create") {
      // ✅ FULL RESET for new item
      setItemTitle("");
      setCategoryValues({});
      setLocks({});
    } else {
      setItemTitle(activeItem?.title || "");
    }

    loadCategories();
  }, [mode, activeItem, loadCategories]);

  // ---------------- DELETE CATEGORY ----------------
  const handleDeleteCategory = async (cat) => {
    if (!window.confirm("Delete this category and all its data?")) return;
    try {
      await deleteCategoryAPI(cat.id);
      await loadCategories();
      onRefresh();
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  // ---------------- SAVE ITEM ----------------
  const handleSave = async () => {
    if (!itemTitle.trim()) return;

    if (mode === "create") {
      const valuesToSave = {};
      categories.forEach(cat => {
        if (categoryValues[cat.id]?.trim()) {
          valuesToSave[cat.id] = categoryValues[cat.id];
        }
      });

      await createItemAPI(itemTitle, categories, listingId, valuesToSave);

      const timeCat = categories.find(c => c.title.toLowerCase() === "time");
      if (timeCat && categoryValues[timeCat.id]) {
        const [datePart, timePart] = categoryValues[timeCat.id].split('T');
        if (datePart && timePart) {
          const [hour, minute] = timePart.split(':').map(Number);
          await createEvent({
            title: `Item: ${itemTitle}`,
            date: datePart,
            hour,
            minute
          });
        }
      }
    }

    onRefresh();
    onClose();
  };

  // ---------------- UPDATE VALUE ----------------
  const handleUpdateField = async (catId, newValue) => {
    if (!newValue.trim()) return;

    try {
      const valObj = activeItem?.item_values?.find(iv => iv.category_id === catId);

      if (valObj) {
        await updateValueAPI(valObj.id, newValue);
      } else if (mode === "edit" && activeItem) {
        const { error } = await supabase
          .from('item_values')
          .insert([{
            id: uuidv4(),
            item_id: activeItem.id,
            category_id: catId,
            value: newValue
          }]);

        if (error) {
          console.error("Failed to insert new value:", error);
          return;
        }
      }

      setCategoryValues(prev => ({
        ...prev,
        [catId]: newValue
      }));

      onRefresh();

    } catch (err) {
      console.error("Failed to update value:", err);
    }
  };

  // ---------------- ADD CATEGORY ----------------
  const addGlobalCategory = async () => {
    if (!newCategoryTitle.trim()) return;

    const newCat = await addCategoryAPI(newCategoryTitle, [], listingId, true);
    setCategories(prev => [...prev, newCat]);
    setLocks(prev => ({ ...prev, [newCat.id]: true }));
    setNewCategoryTitle("");
    onRefresh();
  };

  const addLocalCategory = async () => {
    if (!newCategoryTitle.trim() || !activeItem?.listing_uuid) return;

    const { data: newCat, error } = await supabase
      .from('categories')
      .insert({
        id: uuidv4(),
        title: newCategoryTitle,
        listing_uuid: activeItem.listing_uuid,
        is_global: false
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to add local category:", error);
      return;
    }

    setCategories(prev => [...prev, newCat]);
    setLocks(prev => ({ ...prev, [newCat.id]: true }));
    setNewCategoryTitle("");
    onRefresh();
  };

  const handleAddCategory = async () => {
    if (mode === "create") await addGlobalCategory();
    else await addLocalCategory();
  };

  if (!mode) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{mode === 'create' ? "Add New Item" : `Editing: ${activeItem?.title}`}</h2>

        {/* Item Name */}
        <div className="category-input-row">
          <label>Item Name</label>
          <input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            className="input"
          />
        </div>

        <hr />

        {/* Categories */}
        <div className="category-inputs">
          {categories.map(cat => {
            const isTime = cat.title.toLowerCase() === "time";
            const val = categoryValues[cat.id] || "";
            const locked = locks[cat.id];

            const canDelete = (mode === "edit" && !cat.is_global) ||
                              (mode === "create" && cat.is_global);

            return (
              <div key={cat.id} className="category-input-row">
                <label>{cat.title}</label>
                <input
                  type={isTime ? "datetime-local" : "text"}
                  value={val}
                  className="input"
                  readOnly={locked}
                  onChange={(e) =>
                    setCategoryValues(prev => ({
                      ...prev,
                      [cat.id]: e.target.value
                    }))
                  }
                />

                <button
                  className="btn-lock"
                  onClick={async () => {
                    if (!locked) {
                      await handleUpdateField(cat.id, categoryValues[cat.id] || "");
                    }
                    setLocks(prev => ({ ...prev, [cat.id]: !prev[cat.id] }));
                  }}
                >
                  {locked ? "🔒" : "🔓"}
                </button>

                {canDelete && (
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

        {/* Add New Category */}
        <div className="category-management-section">
          <h3>{mode === 'edit' ? "Add Specific Detail" : "Manage Global Template"}</h3>
          <div className="add-category-row">
            <input
              value={newCategoryTitle}
              onChange={(e) => setNewCategoryTitle(e.target.value)}
              className="input"
            />
            <button onClick={handleAddCategory} className="btn">Add</button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
          {mode === 'create' && (
            <button className="btn-primary" onClick={handleSave}>Create Item</button>
          )}
        </div>
      </div>
    </div>
  );
}