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

  // OPEN LOGIN MODAL (reset forgot password state)
  const openLoginModal = () => {
    setResetEmailSent(false);
    setShowLogin(true);
  };

  // LOGIN
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });

    if (error) {
      alert("Invalid email or password!");
    } else {
      setIsLoggedIn(true);
      closeAllModals();
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      alert("Please enter your email first.");
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
    const confirmLogout = window.confirm(
      "Are you sure you want to log out?"
    );

    if (!confirmLogout) return;

    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  // REGISTER VALIDATION
  const validateRegistration = () => {
    const { email, password, confirmPassword, name } = registrationData;

    if (!email || !password || !confirmPassword || !name) {
      setRegistrationError("All fields are required.");
      return false;
    }

    if (password !== confirmPassword) {
      setRegistrationError("Passwords do not match.");
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
              <button
                className="btn"
                onClick={openLoginModal}
              >
                Login
              </button>

              <button
                className="btn"
                onClick={() => setShowRegister(true)}
              >
                Register
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                onClick={() => navigate("/home")}
              >
                Go to the App
              </button>

              <button
                className="btn"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Login</h2>

            <input
              type="email"
              placeholder="Email"
              className="input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="input"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />

            {/* FORGOT PASSWORD */}
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
                Forgot password?
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
                Reset email sent! Check your inbox.
              </p>
            )}

            <div className="btn-row">
              <button className="btn" onClick={handleLogin}>
                Login
              </button>

              <button className="btn" onClick={closeAllModals}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {showRegister && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create Account</h2>

            {registrationError && (
              <div style={{ color: "red", marginBottom: "10px" }}>
                {registrationError}
              </div>
            )}

            <form
              onSubmit={handleRegisterSubmit}
              className="modal-form"
            >
              <input
                type="email"
                placeholder="Email"
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
                placeholder="Password"
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
                placeholder="Confirm Password"
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
                placeholder="Name"
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
                  Register
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={closeAllModals}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}