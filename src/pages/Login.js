import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "./struct_logo2.jpg";
import "./login.css";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO TOOL (local only, nothing is saved or synced)
// Lives in this file so the homepage stays self-contained. All class names are
// prefixed with "demo-" so they can't clash with login.css or ItemManager.css.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_TYPES = [
  { label: "Own",              value: "own"      },
  { label: "Date",             value: "date"     },
  { label: "Schedule",         value: "schedule" },
  { label: "Potential client", value: "lead"     },
  { label: "Custom",           value: "custom"   },
];

const DEMO_LEAD_OPTIONS = [
  "Connected", "Rejected", "Contact", "Follow-up 1", "Follow-up 2", "Follow-up 3"
];

const DEMO_TEMPLATE = [
  { title: "Name",                type: "own" },
  { title: "Contact Information", type: "own" },
  { title: "Address",             type: "own" },
  { title: "Notes",               type: "own" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function demoAutoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function makeInitialData() {
  const phone  = { id: uid(), title: "Phone",      type: "own",  options: [] };
  const status = { id: uid(), title: "Status",     type: "lead", options: [] };
  const visit  = { id: uid(), title: "Visit date", type: "date", options: [] };
  return {
    categories: [phone, status, visit],
    items: [
      { id: uid(), title: "Anna Virtanen", values: { [phone.id]: "040 123 4567", [status.id]: "Connected",   [visit.id]: "2026-11-03" } },
      { id: uid(), title: "Mika Laine",    values: { [phone.id]: "050 987 6543", [status.id]: "Follow-up 1", [visit.id]: "2026-11-10" } },
    ],
  };
}

// One field inside the editor. Mirrors CategoryField, minus photo/file uploads.
function DemoField({ cat, value, locked, onChange, onRename, onDelete, onChangeType, onAddOption, onDeleteOption }) {
  const [showTools, setShowTools] = useState(false);
  const [renaming, setRenaming]   = useState(false);
  const [titleDraft, setTitleDraft] = useState(cat.title);
  const [newOption, setNewOption] = useState("");
  const taRef = useRef(null);

  useEffect(() => { setTitleDraft(cat.title); }, [cat.title]);
  useEffect(() => { demoAutoResize(taRef.current); }, [value]);

  const saveRename = () => {
    const t = titleDraft.trim();
    if (t && t !== cat.title) onRename(t);
    else setTitleDraft(cat.title);
    setRenaming(false);
  };

  const renderInput = () => {
    if (cat.type === "date") {
      return <input type="date" className="demo-input" value={value || ""} readOnly={locked}
        onChange={(e) => onChange(e.target.value)} />;
    }
    if (cat.type === "schedule") {
      return <input type="datetime-local" className="demo-input" value={value || ""} readOnly={locked}
        onChange={(e) => onChange(e.target.value)} />;
    }
    if (cat.type === "lead" || cat.type === "custom") {
      const options = cat.type === "lead" ? DEMO_LEAD_OPTIONS : cat.options.map(o => o.label);
      return (
        <select className="demo-input" value={value || ""} disabled={locked}
          onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <textarea ref={taRef} className="demo-input demo-textarea" value={value || ""} readOnly={locked}
        onChange={(e) => { onChange(e.target.value); demoAutoResize(e.target); }} />
    );
  };

  return (
    <div className="demo-field">
      <div className="demo-field-side">
      <div className="demo-field-head">
        {renaming ? (
          <input autoFocus className="demo-input" value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); saveRename(); }
              if (e.key === "Escape") { setTitleDraft(cat.title); setRenaming(false); }
            }} />
        ) : (
          <>
            <label>{cat.title}</label>
            {!locked && (
              <button className="demo-icon-btn" onClick={() => setShowTools(p => !p)} title="Options">
                {showTools ? "✕" : "⋯"}
              </button>
            )}
          </>
        )}
      </div>

      {showTools && !locked && !renaming && (
        <div className="demo-tools">
          <button className="demo-btn demo-btn-small" onClick={() => { setRenaming(true); setShowTools(false); }}>Rename</button>
          <select className="demo-input demo-type-select" value={cat.type}
            onChange={(e) => onChangeType(e.target.value)}>
            {DEMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button className="demo-btn demo-btn-danger demo-btn-small" onClick={onDelete}>Delete</button>
        </div>
      )}

      </div>

      <div className="demo-field-main">
      {cat.type === "custom" && showTools && !locked && (
        <div className="demo-options-manager">
          {cat.options.length === 0 && <span className="demo-muted">No options yet</span>}
          {cat.options.map(o => (
            <div key={o.id} className="demo-option-row">
              <span>{o.label}</span>
              <button className="demo-icon-btn" onClick={() => onDeleteOption(o.id)}>✕</button>
            </div>
          ))}
          <div className="demo-add-row">
            <input className="demo-input" placeholder="New option" value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOption.trim()) { e.preventDefault(); onAddOption(newOption.trim()); setNewOption(""); }
              }} />
            <button className="demo-btn" onClick={() => { if (newOption.trim()) { onAddOption(newOption.trim()); setNewOption(""); } }}>Add</button>
          </div>
        </div>
      )}

      {renderInput()}
      </div>
    </div>
  );
}

// Turns one value into a safe CSV cell: no line breaks (the app's CSV import
// reads one row per line), and quotes around anything with commas or quotes.
function csvCell(v) {
  const text = String(v ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function DemoTool() {
  const [data, setData] = useState(makeInitialData);
  const { categories, items } = data;

  const [search, setSearch]           = useState("");
  const [editor, setEditor]           = useState(null); // { mode, itemId }
  const [draftTitle, setDraftTitle]   = useState("");
  const [draftValues, setDraftValues] = useState({});
  const [locked, setLocked]           = useState(false);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const filtered = items.filter(i => i.title.toLowerCase().startsWith(search.toLowerCase()));

  const openCreate = () => {
    setDraftTitle(""); setDraftValues({}); setLocked(false);
    setEditor({ mode: "create" });
  };
  const openEdit = (item) => {
    setDraftTitle(item.title); setDraftValues({ ...item.values }); setLocked(true);
    setEditor({ mode: "edit", itemId: item.id });
  };
  const closeEditor = () => { setEditor(null); setShowTemplates(false); setNewCatTitle(""); };

  const save = () => {
    const title = draftTitle.trim();
    if (!title) return;
    // Drop empty values so the stored item stays clean
    const values = {};
    Object.entries(draftValues).forEach(([k, v]) => { if (String(v || "").trim()) values[k] = v; });

    setData(prev => editor.mode === "create"
      ? { ...prev, items: [...prev.items, { id: uid(), title, values }] }
      : { ...prev, items: prev.items.map(i => i.id === editor.itemId ? { ...i, title, values } : i) });
    closeEditor();
  };

  const deleteItem = (id) => {
    if (!window.confirm("Delete this item?")) return;
    setData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const addCategory = (title, type = "own") => {
    const t = title.trim();
    if (!t) return;
    setData(prev => ({ ...prev, categories: [...prev.categories, { id: uid(), title: t, type, options: [] }] }));
  };

  const updateCategory = (id, patch) =>
    setData(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, ...patch } : c) }));

  const deleteCategory = (cat) => {
    if (!window.confirm("Delete this category?\n\nThis removes it, along with its values, from all items.")) return;
    setData(prev => ({
      categories: prev.categories.filter(c => c.id !== cat.id),
      items: prev.items.map(i => {
        const { [cat.id]: _removed, ...rest } = i.values;
        return { ...i, values: rest };
      }),
    }));
    setDraftValues(prev => { const { [cat.id]: _r, ...rest } = prev; return rest; });
  };

  const applyTemplate = () => {
    const existing = categories.map(c => c.title.toLowerCase());
    DEMO_TEMPLATE.forEach(t => { if (!existing.includes(t.title.toLowerCase())) addCategory(t.title, t.type); });
    setShowTemplates(false);
  };

  // Downloads the current list as a CSV file. First column is "Title" and the
  // other columns are the categories, so it can be imported into a real account.
  const downloadCsv = () => {
    if (items.length === 0) return;
    const header = ["Title", ...categories.map(c => c.title)];
    const rows = items.map(item => [item.title, ...categories.map(c => item.values[c.id] || "")]);
    const csv = [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");

    // The BOM makes Excel read ä, ö and other special characters correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "struct-list.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (!window.confirm("Reset the demo to its starting data?")) return;
    setData(makeInitialData());
    setSearch("");
  };

  return (
    <section className="demo-section" id="try-it">
      <div className="demo-intro">
        <h2>Try it without an account</h2>
        <p>
          Add items, then change the categories and see every item follow the same structure.
          This demo runs only in your browser: nothing is saved, and a refresh resets it. Download your list as a CSV to keep it.
        </p>
      </div>

      <div className="demo-card">
        <div className="demo-toolbar">
          <button className="demo-btn demo-btn-primary" onClick={openCreate}>Add item</button>
          <input className="demo-input demo-search" placeholder="Search items..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="demo-btn" onClick={downloadCsv} disabled={items.length === 0}>Download CSV</button>
          <button className="demo-btn" onClick={reset}>Reset</button>
          <span className="demo-count">{filtered.length} / {items.length}</span>
        </div>

        <div className="demo-list">
          {filtered.length === 0 && (
            <p className="demo-muted demo-empty">
              {items.length === 0 ? "No items yet. Choose Add item to create the first one." : "No items match your search."}
            </p>
          )}
          {filtered.map(item => (
            <div key={item.id} className="demo-row">
              <span className="demo-row-title" onClick={() => openEdit(item)}>{item.title}</span>
              <button className="demo-btn demo-btn-danger demo-btn-small" onClick={() => deleteItem(item.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {editor && (
        <div className="demo-overlay">
          <div className="demo-modal">
            <div className="demo-modal-head">
              <h3>{editor.mode === "create" ? "Add new item" : `Editing: ${items.find(i => i.id === editor.itemId)?.title || ""}`}</h3>
              <button className="demo-icon-btn demo-lock" onClick={() => setLocked(p => !p)}
                title={locked ? "Unlock to edit" : "Lock"}>
                {locked ? "🔒" : "🔓"}
              </button>
            </div>

            <div className="demo-field">
              <div className="demo-field-side">
                <div className="demo-field-head"><label>Item name</label></div>
              </div>
              <div className="demo-field-main">
              <textarea className="demo-input demo-textarea" value={draftTitle} readOnly={locked}
                ref={(el) => el && demoAutoResize(el)}
                onChange={(e) => { setDraftTitle(e.target.value); demoAutoResize(e.target); }} />
              </div>
            </div>

            <hr className="demo-hr" />

            {categories.map(cat => (
              <DemoField
                key={cat.id}
                cat={cat}
                value={draftValues[cat.id]}
                locked={locked}
                onChange={(v) => setDraftValues(prev => ({ ...prev, [cat.id]: v }))}
                onRename={(t) => updateCategory(cat.id, { title: t })}
                onDelete={() => deleteCategory(cat)}
                onChangeType={(type) => updateCategory(cat.id, { type })}
                onAddOption={(label) => updateCategory(cat.id, { options: [...cat.options, { id: uid(), label }] })}
                onDeleteOption={(oid) => updateCategory(cat.id, { options: cat.options.filter(o => o.id !== oid) })}
              />
            ))}

            <div className="demo-add-row">
              <input className="demo-input" placeholder="New category" value={newCatTitle}
                onChange={(e) => setNewCatTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(newCatTitle); setNewCatTitle(""); } }} />
              <button className="demo-btn" onClick={() => { addCategory(newCatTitle); setNewCatTitle(""); }}>Add</button>
            </div>

            <div className="demo-actions">
              <button className="demo-btn" onClick={closeEditor}>Close</button>
              <button className="demo-btn" onClick={() => setShowTemplates(true)}>Templates</button>
              <button className="demo-btn demo-btn-primary" onClick={save}>
                {editor.mode === "create" ? "Create item" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="demo-overlay demo-overlay-top">
          <div className="demo-modal demo-modal-small">
            <h3>Templates</h3>
            <button className="demo-btn" onClick={applyTemplate}>Roofing: Customer Tracking</button>
            <div className="demo-actions">
              <button className="demo-btn" onClick={() => setShowTemplates(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

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
              <button
                className="btn"
                onClick={() => document.getElementById("try-it")?.scrollIntoView({ behavior: "smooth" })}
              >
                Try it free
              </button>

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

      </div>

      {/* LOCAL DEMO TOOL */}
      <DemoTool />

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