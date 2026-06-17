import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchItems, addItem, deleteListing } from './todoLogic';
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

  const [profile, setProfile] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

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
        setTimeLeft("Expirado");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m restantes`);
    }, 1000 * 60);

    return () => clearInterval(interval);
  }, [profile]);

  // =========================
  // UPGRADE
  // =========================
  const upgradeToPro = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Debes iniciar sesión");
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
      alert("La suscripción se cancelará al final del período.");
      fetchProfile();
    }
  };

  const openDelete = (item) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
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
          Mejorar a Pro
        </button>
      );
    }

    if (isPro && isCancelled) {
      return (
        <div style={{ marginTop: '20px', color: '#ccc', fontSize: 13 }}>
          <div>
            Pro hasta {endDate ? endDate.toLocaleDateString() : "fecha desconocida"}
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
        Cancelar suscripción
      </button>
    );
  };

  const handleAddItem = () => {
    if (profile?.tier === 'free' && items.length >= 3) {
      alert('Límite del plan gratuito alcanzado. Mejora a Pro para más listas.');
      return;
    }
    setModalOpen(true);
  };

  return (
    <div className="app-container">

      <div className="sidebar">
        <button onClick={() => navigate('/calendar')}>Calendario</button>

        {renderSubscriptionButton()}
      </div>

      <div className="content-wrapper">
        <div className="vertical-line"></div>

        <div className="main-content">
          <div className="top-bar">
            <button className="plus-button" onClick={handleAddItem}>+</button>

            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="horizontal-line"></div>

          <div className="items-container">
            {loading ? (
              <p style={{ padding: '20px', color: '#666' }}>Cargando...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ padding: '20px', color: '#666' }}>
                Aún no hay entradas. Agrega una con el botón "+".
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

      {/* MODALS */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Ingresa el texto</h2>
            <input
              type="text"
              value={modalText}
              onChange={e => setModalText(e.target.value)}
              autoFocus
              className="modal-input"
            />
            <div className="modal-buttons">
              <button onClick={() => setModalOpen(false)}>Cerrar</button>
              <button onClick={() => addItem(modalText, items, setItems, setModalText, setModalOpen)}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Eliminar entrada</h2>
            <p>¿Estás seguro?</p>
            <button onClick={() => setDeleteModalOpen(false)}>Cancelar</button>
            <button onClick={() =>
              deleteListing(itemToDelete, items, setItems, setDeleteModalOpen, setItemToDelete)
            }>
              Eliminar
            </button>
          </div>
        </div>
      )}

      {upgradeModalOpen && (
        <div className="modal-overlay" onClick={() => setUpgradeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Mejorar a Pro</h2>
            <p>¡Mejora a Pro y disfruta de listas ilimitadas!</p>
            <button onClick={() => setUpgradeModalOpen(false)}>Cancelar</button>
            <button onClick={upgradeToPro}>Mejorar</button>
          </div>
        </div>
      )}
    </div>
  );
}