import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from '../supabaseClient';
import {
  fetchCategories,
  fetchItems,
  deleteItems as deleteItemsAPI,
  deleteItem as deleteItemAPI,
  createItem as createItemAPI
} from "./supabaseService";

import './ItemManager.css';
import ItemEditorModal from "./ItemEditorModal";

export default function ItemManager() {
  const { id: listingId } = useParams();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tier, setTier] = useState('free');

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState({});
  const [categoryDropdowns, setCategoryDropdowns] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  const [modalMode, setModalMode] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [openSearchModal, setOpenSearchModal] = useState(false);
  const [openConfirmDelete, setOpenConfirmDelete] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState({ mode: null, id: null });

  // CSV import state
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState(null);

  const loadData = useCallback(async () => {
    const [cats, its] = await Promise.all([
      fetchCategories(listingId),
      fetchItems(listingId)
    ]);

    setCategories(cats);
    setItems(its);

    const dropdowns = {};
    cats.forEach(cat => {
      const uniqueVals = new Set(
        its.flatMap(item =>
          item.item_values
            .filter(iv => iv.category_id === cat.id && iv.value)
            .map(iv => String(iv.value).trim())
        )
      );
      dropdowns[cat.id] = Array.from(uniqueVals).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
    });
    setCategoryDropdowns(dropdowns);
  }, [listingId]);

  useEffect(() => {
    const fetchTier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('profiles').select('tier').eq('user_id', user.id).single();
      if (data) setTier(data.tier);
    };

    fetchTier();
    loadData();
  }, [loadData]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title?.toLowerCase().startsWith(searchQuery.toLowerCase());
    const matchesCategories = Object.entries(categoryFilters).every(([catId, val]) => {
      if (!val) return true;
      const itemVal = item.item_values?.find(iv => String(iv.category_id) === String(catId));
      return String(itemVal?.value || '').trim().toLowerCase() === val.toLowerCase();
    });
    return matchesSearch && matchesCategories;
  });

  const confirmDelete = async () => {
    if (deleteConfig.mode === 'single') {
      await deleteItemAPI(deleteConfig.id);
    } else {
      const ids = Object.keys(selectedItems).filter(id => selectedItems[id]);
      await deleteItemsAPI(ids);
      setSelectedItems({});
    }
    setOpenConfirmDelete(false);
    loadData();
  };

  const triggerDelete = (id = null) => {
    setDeleteConfig({ mode: id ? 'single' : 'multi', id });
    setOpenConfirmDelete(true);
  };

  // ─── CSV IMPORT ───────────────────────────────────────────────
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvImporting(true);
    setCsvError(null);

    try {
      const text = await file.text();

      // Split into rows, remove blank lines
      const rows = text.trim().split("\n").filter(Boolean);

      if (rows.length < 2) {
        setCsvError("El archivo CSV debe tener al menos una fila de encabezado y una fila de datos.");
        setCsvImporting(false);
        return;
      }

      // Handles quoted values (e.g. "Nombre, Apellido") inside a CSV row
      const parseRow = (row) =>
        row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

      const headers = parseRow(rows[0]);

      // Find the title column — looks for "title" (case-insensitive), falls back to first column
      const titleIndex = headers.findIndex(h => h.toLowerCase() === "title");
      const resolvedTitleIndex = titleIndex === -1 ? 0 : titleIndex;

      // Fetch existing categories
      let latestCategories = await fetchCategories(listingId);

      // ── AUTO-CREATE MISSING CATEGORIES ──────────────────────────
      // Go through each CSV header and create a category if it doesn't exist yet
      let newCategoriesCount = 0;

      for (const header of headers) {
        // Skip the title column — that's the item name, not a category
        if (header.toLowerCase() === "title") continue;

        const alreadyExists = latestCategories.some(
          cat => cat.title.toLowerCase() === header.toLowerCase()
        );

        if (!alreadyExists) {
          // Create the new category in Supabase
          const { data, error } = await supabase
            .from("categories")
            .insert({
              id: crypto.randomUUID(),
              title: header,           // use the CSV column name as the category title
              type: "own",             // default type — user can change it later
              listing_uuid: listingId,
              is_global: true,         // global so it appears on all items
              order: latestCategories.length + newCategoriesCount
            })
            .select()
            .single();

          if (error) {
            console.error(`Failed to create category "${header}":`, error);
          } else {
            latestCategories = [...latestCategories, data];
            newCategoriesCount++;
          }
        }
      }
      // ────────────────────────────────────────────────────────────

      let importedCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const values = parseRow(rows[i]);
        const itemTitle = values[resolvedTitleIndex];

        // Skip rows without a title
        if (!itemTitle) {
          skippedCount++;
          continue;
        }

        // Build { categoryId → value } by matching header names to category titles
        // This now works for both pre-existing and newly created categories
        const valuesToSave = {};
        headers.forEach((header, colIndex) => {
          if (colIndex === resolvedTitleIndex) return;
          const matchingCategory = latestCategories.find(
            cat => cat.title.toLowerCase() === header.toLowerCase()
          );
          if (matchingCategory && values[colIndex]) {
            valuesToSave[matchingCategory.id] = values[colIndex];
          }
        });

        await createItemAPI(itemTitle, latestCategories, listingId, valuesToSave);
        importedCount++;
      }

      await loadData();

      // Show a summary message of what happened
      const parts = [`Importados ${importedCount} elementos.`];
      if (newCategoriesCount > 0) parts.push(`${newCategoriesCount} categorías nuevas creadas.`);
      if (skippedCount > 0) parts.push(`${skippedCount} filas omitidas (sin título).`);
      if (newCategoriesCount > 0 || skippedCount > 0) {
        setCsvError(parts.join(" "));
      }

    } catch (err) {
      console.error("CSV import failed:", err);
      setCsvError("Error al importar el CSV. Verifica el formato del archivo.");
    } finally {
      setCsvImporting(false);
      // Reset the file input so the same file can be re-uploaded if needed
      e.target.value = "";
    }
  };
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="manager-container">

      {/* Búsqueda y controles superiores */}
      <div className="top-controls">
        <button
          className="btn"
          onClick={() => setModalMode('create')}
          disabled={tier === 'free' && items.length >= 10}
        >
          Agregar elemento
        </button>

        <input
          type="text"
          placeholder="Buscar elementos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input search-input"
        />

        <button className="btn" onClick={() => setOpenSearchModal(true)}>Filtrar</button>
        <button className="btn-delete" onClick={() => triggerDelete()}>Eliminar seleccionados</button>

        {/* CSV IMPORT BUTTON */}
        <input
          type="file"
          accept=".csv"
          id="csv-upload"
          style={{ display: "none" }}
          onChange={handleCSVImport}
        />
        <button
          className="btn"
          onClick={() => document.getElementById("csv-upload").click()}
          disabled={csvImporting}
        >
          {csvImporting ? "Importando..." : "Importar CSV"}
        </button>

        {/* CONTADOR DE ELEMENTOS */}
        <div className="item-count">
          {filteredItems.length} / {items.length}
        </div>
      </div>

      {/* CSV error / success message */}
      {csvError && (
        <div className="csv-message" style={{ padding: "8px 12px", marginBottom: "8px", background: "var(--bg-warning, #fff8e1)", borderRadius: "6px", fontSize: "0.875rem", color: "var(--text-warning, #7a5c00)" }}>
          {csvError}
          <button onClick={() => setCsvError(null)} style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>
        </div>
      )}

      {/* Lista de elementos */}
      <div className="items-list">
        {filteredItems.map(item => (
          <div key={item.id} className="item-row">
            <input
              type="checkbox"
              checked={!!selectedItems[item.id]}
              onChange={() => setSelectedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
            />
            <span className="item-title" onClick={() => { setActiveItem(item); setModalMode('edit'); }}>
              {item.title}
            </span>
            <button onClick={() => triggerDelete(item.id)} className="btn-delete">X</button>
          </div>
        ))}
      </div>

      {/* Modal editor */}
      <ItemEditorModal
        mode={modalMode}
        activeItem={activeItem}
        listingId={listingId}
        categories={categories}
        onClose={() => { setModalMode(null); setActiveItem(null); }}
        onRefresh={loadData}
      />

      {/* Modal de filtros */}
      {openSearchModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Filtrar por categorías</h2>
            {categories.map(cat => (
              <div key={cat.id} className="category-input-row">
                <label>{cat.title}</label>
                <select
                  value={categoryFilters[cat.id] || ''}
                  onChange={e => setCategoryFilters({ ...categoryFilters, [cat.id]: e.target.value })}
                  className="input"
                >
                  <option value="">-- Todos --</option>
                  {categoryDropdowns[cat.id]?.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            ))}
            <button className="btn" onClick={() => setOpenSearchModal(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {openConfirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirmar eliminación</h2>
            <p>¿Eliminar {deleteConfig.mode === 'multi' ? 'los elementos seleccionados' : 'este elemento'}?</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setOpenConfirmDelete(false)}>Cancelar</button>
              <button className="btn-delete" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}