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
      setError("Please fill in both fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
      setSuccess("Password updated successfully!");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-modal">
        <h2>Reset Password</h2>

        {error && <div className="reset-error">{error}</div>}
        {success && <div className="reset-success">{success}</div>}

        <input
          type="password"
          placeholder="New password"
          className="reset-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm new password"
          className="reset-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          className="reset-btn"
          onClick={handleUpdatePassword}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}