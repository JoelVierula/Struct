import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "./struct_logo2.jpg";
import tutorialVideo from "./tutorialvideo_mobile.mp4";
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
      alert("Incorrect email or password!");
      setCooldown(3);
    } else {
      setIsLoggedIn(true);
      closeAllModals();
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      alert("Please enter your email address first.");
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
    const confirmLogout = window.confirm("Are you sure you want to log out?");
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
              <button className="btn" onClick={openLoginModal}>
                Log in
              </button>

              <button className="btn" onClick={() => setShowRegister(true)}>
                Sign up
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => navigate("/home")}>
                Go to app
              </button>

              <button className="btn" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>

      {/* HERO SECTION */}
      <div className="hero-section">
        <div className="hero-text">
          <h1 className="hero-title">What is Struct?</h1>
          <p className="hero-body">
            Struct is a lightweight data management application designed primarily for small businesses. It helps you organize information in a clear and structured way, since all items in the same list follow the same schema, making it easier to navigate and maintain your data.

Schemas are fully customizable, allowing you to modify fields and adjust category types to fit your needs and workflow.

Creating an account is completely free. Free accounts include access to the same features as paid accounts; the only limitation is the amount of data you can store and manage.

          </p>
        </div>

        <div className="video-wrapper">
          <video
            className="tutorial-video"
            src={tutorialVideo}
            controls
            playsInline
          />
          <span className="video-overlay-text">How to add a schema</span>
        </div>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Log in</h2>

            <input
              type="email"
              placeholder="Email address"
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
                Forgot your password?
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
                Recovery email sent! Check your inbox.
              </p>
            )}

            <div className="btn-row">
              <button
                className="btn"
                onClick={handleLogin}
                disabled={cooldown > 0}
                style={{ opacity: cooldown > 0 ? 0.5 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}
              >
                {cooldown > 0 ? `Wait ${cooldown}s...` : "Log in"}
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
            <h2>Create account</h2>

            {registrationError && (
              <div style={{ color: "red", marginBottom: "10px" }}>
                {registrationError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="modal-form">
              <input
                type="email"
                placeholder="Email address"
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
                placeholder="Confirm password"
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
                  Sign up
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