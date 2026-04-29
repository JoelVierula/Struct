import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from '../supabaseClient';
import {
  fetchCategories,
  fetchItems,
  deleteItems as deleteItemsAPI,
  deleteItem as deleteItemAPI
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
      dropdowns[cat.id] = Array.from(uniqueVals);
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

  return (
    <div className="manager-container">

      {/* Search & Top Controls */}
      <div className="top-controls">
        <button 
          className="btn" 
          onClick={() => setModalMode('create')}
          disabled={tier === 'free' && items.length >= 10}
        >
          Add Item
        </button>

        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input search-input"
        />
        
        <button className="btn" onClick={() => setOpenSearchModal(true)}>Filter</button>
        <button className="btn-delete" onClick={() => triggerDelete()}>Delete Selected</button>

        {/* ✅ ITEM COUNTER */}
        <div className="item-count">
          {filteredItems.length} / {items.length}
        </div>
      </div>

      {/* Item List */}
      <div className="items-list">
        {filteredItems.map(item => (
          <div key={item.id} className="item-row">
            <input
              type="checkbox"
              checked={!!selectedItems[item.id]}
              onChange={() => setSelectedItems(prev => ({...prev, [item.id]: !prev[item.id]}))}
            />
            <span className="item-title" onClick={() => { setActiveItem(item); setModalMode('edit'); }}>
              {item.title}
            </span>
            <button onClick={() => triggerDelete(item.id)} className="btn-delete">X</button>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      <ItemEditorModal 
        mode={modalMode} 
        activeItem={activeItem}
        listingId={listingId}
        categories={categories}
        onClose={() => { setModalMode(null); setActiveItem(null); }}
        onRefresh={loadData}
      />

      {/* Filter Modal */}
      {openSearchModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Filter by Categories</h2>
            {categories.map(cat => (
              <div key={cat.id} className="category-input-row">
                <label>{cat.title}</label>
                <select
                  value={categoryFilters[cat.id] || ''}
                  onChange={e => setCategoryFilters({...categoryFilters, [cat.id]: e.target.value})}
                  className="input"
                >
                  <option value="">-- All --</option>
                  {categoryDropdowns[cat.id]?.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            ))}
            <button className="btn" onClick={() => setOpenSearchModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {openConfirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Delete</h2>
            <p>Delete {deleteConfig.mode === 'multi' ? 'selected items' : 'this item'}?</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setOpenConfirmDelete(false)}>Cancel</button>
              <button className="btn-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}