import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchItems, addItem, deleteListing, renameItem, setListPassword, verifyListPassword } from './todoLogic';
import { supabase } from '../supabaseClient';
import "./home.css";

export default function Home() {
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [renameText, setRenameText] = useState('');

  const [profile, setProfile] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  // Password: setting
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [itemToPassword, setItemToPassword] = useState(null);
  const [passwordText, setPasswordText] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Password: unlocking to open
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [itemToUnlock, setItemToUnlock] = useState(null);
  const [unlockText, setUnlockText] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchItems(setItems, setLoading);
    fetchProfile();
  }, []);

  // =========================
  // FETCH PROFILE
  // =========================
  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setProfile(data);
  };

  // =========================
  // COUNTDOWN TIMER
  // =========================
  useEffect(() => {
    if (!profile?.current_period_end || !profile?.cancel_at_period_end) return;

    const interval = setInterval(() => {
      const end = new Date(profile.current_period_end).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
    }, 1000 * 60);

    return () => clearInterval(interval);
  }, [profile]);

  // =========================
  // UPGRADE
  // =========================
  const upgradeToPro = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in");
      return;
    }

    const res = await fetch(
      "https://omigxszvhmgeorbupspa.supabase.co/functions/v1/create-checkout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }
    );

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }
  };

  // =========================
  // CANCEL SUBSCRIPTION
  // =========================
  const handleCancelSubscription = async () => {
    const { data } = await supabase.auth.getSession();

    if (!data?.session) return;

    const res = await fetch(
      "https://omigxszvhmgeorbupspa.supabase.co/functions/v1/cancel-subscription",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );

    const result = await res.json();

    if (result.success) {
      alert("Your subscription will be cancelled at the end of the current period.");
      fetchProfile();
    }
  };

  const openDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const openRename = (item) => {
    setItemToRename(item);
    setRenameText(item.task);
    setRenameModalOpen(true);
  };

  const openPasswordModal = (item) => {
    setItemToPassword(item);
    // Pre-fill blank — user sets a new one or clears existing
    setPasswordText('');
    setPasswordModalOpen(true);
  };

  // =========================
  // OPEN LIST (with password gate)
  // =========================
  const openListing = (item) => {
    if (item.password_hash) {
      setItemToUnlock(item);
      setUnlockText('');
      setUnlockError(false);
      setUnlockModalOpen(true);
    } else {
      navigate(`/listing/${item.uuid_id}`);
    }
  };

  const handleUnlockSubmit = async () => {
    const ok = await verifyListPassword(itemToUnlock, unlockText);
    if (ok) {
      setUnlockModalOpen(false);
      setUnlockText('');
      setUnlockError(false);
      navigate(`/listing/${itemToUnlock.uuid_id}`);
    } else {
      setUnlockError(true);
    }
  };

  // =========================
  // SAVE PASSWORD
  // =========================
  const handleSavePassword = async () => {
    setPasswordSaving(true);
    // Passing empty string removes the password (sets null)
    await setListPassword(itemToPassword, passwordText.trim(), items, setItems);
    setPasswordSaving(false);
    setPasswordModalOpen(false);
    setItemToPassword(null);
    setPasswordText('');
  };

  const filteredItems = items.filter(item =>
    item.task.toLowerCase().startsWith(searchTerm.toLowerCase())
  );

  // =========================
  // SUBSCRIPTION UI
  // =========================
  const renderSubscriptionButton = () => {
    if (!profile) return null;

    const isPro = profile.tier === "pro";
    const isCancelled = profile.cancel_at_period_end;
    const endDate = profile.current_period_end
      ? new Date(profile.current_period_end)
      : null;

    if (!isPro) {
      return (
        <button
          onClick={() => setUpgradeModalOpen(true)}
          style={{ marginTop: '20px', backgroundColor: '#f0ad4e', color: 'white' }}
        >
          Upgrade to Pro
        </button>
      );
    }

    if (isPro && isCancelled) {
      return (
        <div style={{ marginTop: '20px', color: '#ccc', fontSize: 13 }}>
          <div>
            Pro until {endDate ? endDate.toLocaleDateString() : "unknown date"}
          </div>
          <div style={{ marginTop: 5, color: "#aaa" }}>
            {timeLeft}
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={handleCancelSubscription}
        style={{ marginTop: '20px', backgroundColor: '#d9534f', color: 'white' }}
      >
        Cancel subscription
      </button>
    );
  };

  const handleAddItem = () => {
    if (profile?.tier === 'free' && items.length >= 3) {
      alert('Free plan limit reached. Upgrade to Pro for more lists.');
      return;
    }
    setModalOpen(true);
  };

  return (
    <div className="app-container">

      <div className="sidebar">
        <button onClick={() => navigate('/calendar')}>Calendar</button>
        {renderSubscriptionButton()}
      </div>

      <div className="content-wrapper">
        <div className="vertical-line"></div>

        <div className="main-content">
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

          <div className="items-container">
            {loading ? (
              <p style={{ padding: '20px', color: '#666' }}>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ padding: '20px', color: '#666' }}>
                No entries yet. Add one with the "+" button.
              </p>
            ) : (
              filteredItems.map(item => (
                <div key={item.uuid_id} className="item-row">
                  {/* Replaced <Link> with a div so we can intercept for password */}
                  <div
                    className="item-link"
                    onClick={() => openListing(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="item">
                      {item.password_hash ? '🔒 ' : ''}{item.task}
                    </div>
                  </div>
                  <button className="edit-button" onClick={() => openRename(item)}>✎</button>
                  <button className="edit-button" onClick={() => openPasswordModal(item)}>
                    {item.password_hash ? '🔑' : '🔒'}
                  </button>
                  <button className="delete-button" onClick={() => openDelete(item)}>X</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ADD MODAL */}
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
              <button onClick={() => setModalOpen(false)}>Close</button>
              <button onClick={() => addItem(modalText, items, setItems, setModalText, setModalOpen)}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Delete entry</h2>
            <p>Are you sure?</p>
            <button onClick={() => setDeleteModalOpen(false)}>Cancel</button>
            <button onClick={() =>
              deleteListing(itemToDelete, items, setItems, setDeleteModalOpen, setItemToDelete)
            }>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameModalOpen && (
        <div className="modal-overlay" onClick={() => setRenameModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Rename list</h2>
            <input
              type="text"
              value={renameText}
              onChange={e => setRenameText(e.target.value)}
              autoFocus
              className="modal-input"
            />
            <div className="modal-buttons">
              <button onClick={() => setRenameModalOpen(false)}>Cancel</button>
              <button onClick={() =>
                renameItem(itemToRename, renameText, items, setItems, setRenameModalOpen, setItemToRename)
              }>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SET PASSWORD MODAL */}
      {passwordModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{itemToPassword?.password_hash ? 'Change password' : 'Add password'}</h2>
            <p style={{ color: '#aaa', fontSize: 13 }}>
              {itemToPassword?.password_hash
                ? 'Enter a new password, or leave it empty to remove the password.'
                : 'This list will be password protected.'}
            </p>
            <input
              type="password"
              value={passwordText}
              onChange={e => setPasswordText(e.target.value)}
              autoFocus
              className="modal-input"
              placeholder="Password..."
            />
            <div className="modal-buttons">
              <button onClick={() => setPasswordModalOpen(false)}>Cancel</button>
              <button onClick={handleSavePassword} disabled={passwordSaving}>
                {passwordSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNLOCK MODAL */}
      {unlockModalOpen && (
        <div className="modal-overlay" onClick={() => { setUnlockModalOpen(false); setUnlockText(''); setUnlockError(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Protected list</h2>
            <p style={{ color: '#aaa', fontSize: 13 }}>Enter the password to open this list.</p>
            <input
              type="password"
              value={unlockText}
              onChange={e => { setUnlockText(e.target.value); setUnlockError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleUnlockSubmit()}
              autoFocus
              className="modal-input"
              placeholder="Password..."
            />
            {unlockError && (
              <p style={{ color: '#d9534f', fontSize: 13, marginTop: 6 }}>
                Incorrect password.
              </p>
            )}
            <div className="modal-buttons">
              <button onClick={() => { setUnlockModalOpen(false); setUnlockText(''); setUnlockError(false); }}>
                Cancel
              </button>
              <button onClick={handleUnlockSubmit}>Open</button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {upgradeModalOpen && (
        <div className="modal-overlay" onClick={() => setUpgradeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Upgrade to Pro</h2>
            <p>Upgrade to Pro and enjoy unlimited lists!</p>
            <button onClick={() => setUpgradeModalOpen(false)}>Cancel</button>
            <button onClick={upgradeToPro}>Upgrade</button>
          </div>
        </div>
      )}
    </div>
  );
}