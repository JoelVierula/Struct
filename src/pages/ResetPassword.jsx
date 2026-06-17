import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "./ResetPassword.css";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();

  const handleUpdatePassword = async () => {
    setError("");
    setSuccess("");

    if (!password || !confirmPassword) {
      setError("Por favor, completa ambos campos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess("¡Contraseña actualizada con éxito!");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-modal">
        <h2>Restablecer contraseña</h2>

        {error && <div className="reset-error">{error}</div>}
        {success && <div className="reset-success">{success}</div>}

        <input
          type="password"
          placeholder="Nueva contraseña"
          className="reset-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirmar nueva contraseña"
          className="reset-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          className="reset-btn"
          onClick={handleUpdatePassword}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </div>
    </div>
  );
}