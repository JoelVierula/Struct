// Home.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchItems, addItem, deleteListing } from './todoLogic';
import { supabase } from '../supabaseClient';
import "./home.css";

export default function Home() {
  // --- State variables ---
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false); // for upgrade modal
  const [userTier, setUserTier] = useState('free'); // user's tier

  const navigate = useNavigate();

  // --- Fetch items and tier on mount ---
  useEffect(() => {
    fetchItems(setItems, setLoading);
    fetchTier();
  }, []);

  const fetchTier = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (data) setUserTier(data.tier);
  };

  // --- Add item with free tier limit check ---
  const handleAddItem = () => {
    if (userTier === 'free' && items.length >= 3) {
      alert('Free tier limit reached. Upgrade to Pro for more lists.');
      return;
    }
    setModalOpen(true);
  };

  // --- Upgrade tier ---
  const upgradeToPro = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ tier: 'pro' })
      .eq('user_id', user.id);

    if (!error) {
      setUserTier('pro');
      setUpgradeModalOpen(false);
      alert('🎉 Successfully upgraded to Pro!');
    } else {
      alert('❌ Upgrade failed. Try again.');
    }
  };

  // --- Open delete modal ---
  const openDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  // --- Filtered items ---
  const filteredItems = items.filter(item =>
    item.task.toLowerCase().startsWith(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <button onClick={() => navigate('/calendar')}>Calendar</button>
        {userTier === 'free' && (
          <button
            onClick={() => setUpgradeModalOpen(true)}
            style={{ marginTop: '20px', backgroundColor: '#f0ad4e', color: 'white' }}
          >
            Upgrade to Pro
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="content-wrapper">
        <div className="vertical-line"></div>
        <div className="main-content">
          {/* Top bar */}
          <div className="top-bar">
            <button className="plus-button" onClick={handleAddItem}>+</button>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="horizontal-line"></div>

          {/* Items container */}
          <div className="items-container">
            {loading ? (
              <p style={{ padding: '20px', color: '#666' }}>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ padding: '20px', color: '#666' }}>
                No listings yet. Add one using the "+" button.
              </p>
            ) : (
              filteredItems.map(item => (
                <div key={item.uuid_id} className="item-row">
                  <Link to={`/listing/${item.uuid_id}`} className="item-link">
                    <div className="item">{item.task}</div>
                  </Link>
                  <button className="delete-button" onClick={() => openDelete(item)}>X</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Enter text</h2>
            <input
              type="text"
              value={modalText}
              onChange={e => setModalText(e.target.value)}
              autoFocus
              className="modal-input"
            />
            <div className="modal-buttons">
              <button className="modal-close" onClick={() => setModalOpen(false)}>Close</button>
              <button
                className="modal-add"
                onClick={() => addItem(modalText, items, setItems, setModalText, setModalOpen)}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Delete Listing</h2>
            <p>Are you sure you want to delete this item?</p>
            <div className="modal-buttons">
              <button className="modal-close" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button
                className="modal-add"
                style={{ backgroundColor: '#d9534f' }}
                onClick={() =>
  deleteListing(
    itemToDelete,
    items,
    setItems,
    setDeleteModalOpen,
    setItemToDelete
  )
}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {upgradeModalOpen && (
        <div className="modal-overlay" onClick={() => setUpgradeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Upgrade to Pro</h2>
            <p>Upgrade to Pro and enjoy unlimited lists!</p>
            <div className="modal-buttons">
              <button className="modal-close" onClick={() => setUpgradeModalOpen(false)}>Cancel</button>
              <button className="modal-add" onClick={upgradeToPro}>Upgrade</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}