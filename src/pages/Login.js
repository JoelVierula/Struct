import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "./struct_logo2.jpg";
import "./login.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [cooldown, setCooldown] = useState(0);

  const [registrationData, setRegistrationData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: ""
  });

  const [registrationError, setRegistrationError] = useState("");

  // CHECK SAVED SESSION
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsLoggedIn(true);
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsLoggedIn(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // COOLDOWN TIMER
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // OPEN LOGIN MODAL
  const openLoginModal = () => {
    setResetEmailSent(false);
    setShowLogin(true);
  };

  // LOGIN
  const handleLogin = async () => {
    if (cooldown > 0) return;

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });

    if (error) {
      alert("¡Correo o contraseña incorrectos!");
      setCooldown(3);
    } else {
      setIsLoggedIn(true);
      closeAllModals();
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      alert("Por favor, ingresa tu correo electrónico primero.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: "http://localhost:3000/reset-password"
    });

    if (error) {
      alert(error.message);
    } else {
      setResetEmailSent(true);
    }
  };

  // LOGOUT
  const handleLogout = async () => {
    const confirmLogout = window.confirm("¿Estás seguro de que quieres cerrar sesión?");
    if (!confirmLogout) return;
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  // REGISTER VALIDATION
  const validateRegistration = () => {
    const { email, password, confirmPassword, name } = registrationData;

    if (!email || !password || !confirmPassword || !name) {
      setRegistrationError("Todos los campos son obligatorios.");
      return false;
    }

    if (password !== confirmPassword) {
      setRegistrationError("Las contraseñas no coinciden.");
      return false;
    }

    return true;
  };

  // REGISTER
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!validateRegistration()) return;

    const { error } = await supabase.auth.signUp({
      email: registrationData.email,
      password: registrationData.password,
      options: {
        data: {
          name: registrationData.name
        }
      }
    });

    if (error) {
      setRegistrationError(error.message);
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: registrationData.email,
      password: registrationData.password
    });

    if (loginError) {
      setRegistrationError(loginError.message);
      return;
    }

    setIsLoggedIn(true);
    closeAllModals();
  };

  const closeAllModals = () => {
    setShowLogin(false);
    setShowRegister(false);
  };

  return (
    <div className="page">
      <header className="header">
        <img src={logo} alt="My App Logo" className="logo" />

        <div className="header-buttons">
          {!isLoggedIn ? (
            <>
              <button className="btn" onClick={openLoginModal}>
                Iniciar sesión
              </button>

              <button className="btn" onClick={() => setShowRegister(true)}>
                Registrarse
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => navigate("/home")}>
                Ir a la aplicación
              </button>

              <button className="btn" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </header>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Iniciar sesión</h2>

            <input
              type="email"
              placeholder="Correo electrónico"
              className="input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Contraseña"
              className="input"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />

            {!resetEmailSent ? (
              <p
                style={{
                  cursor: "pointer",
                  color: "#007bff",
                  fontSize: "14px",
                  marginTop: "5px",
                  textAlign: "left"
                }}
                onClick={handleForgotPassword}
              >
                ¿Olvidaste tu contraseña?
              </p>
            ) : (
              <p
                style={{
                  color: "green",
                  fontSize: "14px",
                  marginTop: "5px",
                  textAlign: "left"
                }}
              >
                ¡Correo de recuperación enviado! Revisa tu bandeja de entrada.
              </p>
            )}

            <div className="btn-row">
              <button
                className="btn"
                onClick={handleLogin}
                disabled={cooldown > 0}
                style={{ opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}
              >
                {cooldown > 0 ? `Espera ${cooldown}s...` : "Iniciar sesión"}
              </button>

              <button className="btn" onClick={closeAllModals}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {showRegister && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Crear cuenta</h2>

            {registrationError && (
              <div style={{ color: "red", marginBottom: "10px" }}>
                {registrationError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="modal-form">
              <input
                type="email"
                placeholder="Correo electrónico"
                className="input"
                value={registrationData.email}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    email: e.target.value
                  })
                }
                required
              />

              <input
                type="password"
                placeholder="Contraseña"
                className="input"
                value={registrationData.password}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    password: e.target.value
                  })
                }
                required
              />

              <input
                type="password"
                placeholder="Confirmar contraseña"
                className="input"
                value={registrationData.confirmPassword}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    confirmPassword: e.target.value
                  })
                }
                required
              />

              <input
                type="text"
                placeholder="Nombre"
                className="input"
                value={registrationData.name}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    name: e.target.value
                  })
                }
                required
              />

              <div className="btn-row">
                <button type="submit" className="btn">
                  Registrarse
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={closeAllModals}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}