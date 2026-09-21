import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { updateCategoryTitle, fetchCategoryOptions, addCategoryOption, deleteCategoryOption } from "./supabaseService";

export const CATEGORY_TYPE_OPTIONS = [
  { label: "Propio",            value: "own"      },
  { label: "Fecha",             value: "date"     },
  { label: "Horario",           value: "schedule" },
  { label: "Cliente potencial", value: "lead"     },
  { label: "Personalizado",     value: "custom"   },
  { label: "Foto",              value: "photo"    },
  { label: "Archivo",          value: "file"     },
];

const LEAD_OPTIONS = [
  "Conectado",
  "Rechazado",
  "Contacto",
  "Seguimiento 1",
  "Seguimiento 2",
  "Seguimiento 3"
];

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ─── IMAGE COMPRESSION ────────────────────────────────────────────────────────
// Compresses an image File to a max width/height and quality before uploading.
// This keeps file sizes small (typically under 300 KB) so storage doesn't fill up fast.
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Work out new dimensions while keeping the aspect ratio
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          // Return a new File so it keeps the original name
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}
// ─────────────────────────────────────────────────────────────────────────────

export function CategoryField({
  cat,
  mode,
  value,
  locked,
  onChange,
  onRefresh,
  onDelete
}) {
  const [showButtons,      setShowButtons]      = useState(false);
  const [openTypeMenu,     setOpenTypeMenu]      = useState(false);
  const [openLeadMenu,     setOpenLeadMenu]      = useState(false);
  const [openCustomMenu,   setOpenCustomMenu]    = useState(false);
  const [editingTitle,     setEditingTitle]      = useState(false);
  const [titleDraft,       setTitleDraft]        = useState(cat.title);

  // Custom type state
  const [customOptions,     setCustomOptions]    = useState([]);
  const [newOptionLabel,    setNewOptionLabel]   = useState("");
  const [showCustomManager, setShowCustomManager]= useState(false);

  // Photo type state
  const [photoUploading,   setPhotoUploading]   = useState(false);
  const [photoError,       setPhotoError]        = useState(null);
  const [photoFullscreen,  setPhotoFullscreen]  = useState(false);
  const photoInputRef = useRef(null);

  // File type state
  const [fileUploading,    setFileUploading]     = useState(false);
  const [fileError,        setFileError]         = useState(null);
  const fileInputRef = useRef(null);

  const textareaRef = useRef(null);

  useEffect(() => { setTitleDraft(cat.title); }, [cat.title]);
  useEffect(() => { autoResize(textareaRef.current); }, [value]);

  useEffect(() => {
    if (cat.type === "custom") loadCustomOptions();
  }, [cat.id, cat.type]);

  const loadCustomOptions = async () => {
    const opts = await fetchCategoryOptions(cat.id);
    setCustomOptions(opts);
  };

  const updateCategoryType = async (newType) => {
    const { error } = await supabase
      .from("categories")
      .update({ type: newType })
      .eq("id", cat.id);

    if (error) { console.error(error); return; }

    setOpenTypeMenu(false);
    if (newType === "custom") { setShowCustomManager(true); await loadCustomOptions(); }
    onRefresh?.();
  };

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;
    await addCategoryOption(cat.id, newOptionLabel.trim(), customOptions.length);
    setNewOptionLabel("");
    await loadCustomOptions();
  };

  const handleDeleteOption = async (optionId) => {
    await deleteCategoryOption(optionId);
    await loadCustomOptions();
  };

  const canEditType = mode === "create" || !cat.is_global;
  const canRename   = canEditType && !locked;

  const handleRenameSave = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === cat.title) { setTitleDraft(cat.title); setEditingTitle(false); return; }
    try {
      await updateCategoryTitle(cat.id, trimmed);
      setEditingTitle(false);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to rename category:", err);
      setTitleDraft(cat.title);
      setEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter")  { e.preventDefault(); handleRenameSave(); }
    if (e.key === "Escape") { setTitleDraft(cat.title); setEditingTitle(false); }
  };

  // ─── PHOTO UPLOAD ──────────────────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith("image/")) {
      setPhotoError("El archivo debe ser una imagen (JPG, PNG, etc.)");
      return;
    }

    setPhotoUploading(true);
    setPhotoError(null);

    try {
      // 1. Compress the image before uploading
      //    HEIC files from iPhones can't be drawn on canvas directly,
      //    so if compression fails we fall back to the original file
      let fileToUpload = file;
      try {
        const compressed = await compressImage(file);
        fileToUpload = compressed;
        console.log(`Compressed: ${(file.size / 1024).toFixed(0)} KB → ${(compressed.size / 1024).toFixed(0)} KB`);
      } catch (compressionErr) {
        console.warn("Compression failed, uploading original file:", compressionErr);
        // Continue with the original file instead of failing completely
      }

      // 2. Build a unique file path inside the bucket
      const filePath = `photos/${cat.id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      console.log("Uploading to path:", filePath);

      // 3. Upload to Supabase Storage bucket called "item-photos"
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(filePath, fileToUpload, { upsert: true });

      if (uploadError) {
        // Log the full error so you can see exactly what Supabase says
        console.error("Supabase upload error:", uploadError);
        console.error("Error message:", uploadError.message);
        console.error("Error status:", uploadError.statusCode);

        // Show a specific message depending on the error
        if (uploadError.statusCode === "404") {
          setPhotoError('Bucket no encontrado. Crea un bucket llamado "item-photos" en Supabase Storage.');
        } else if (uploadError.statusCode === "403") {
          setPhotoError("Sin permiso para subir. Revisa las políticas RLS del bucket en Supabase.");
        } else {
          setPhotoError(`Error al subir: ${uploadError.message}`);
        }
        return;
      }

      console.log("Upload successful:", uploadData);

      // 4. Get the public URL and save it as the category value
      const { data } = supabase.storage
        .from("item-photos")
        .getPublicUrl(filePath);

      console.log("Public URL:", data.publicUrl);
      onChange(data.publicUrl);

    } catch (err) {
      console.error("Unexpected photo upload error:", err);
      setPhotoError(`Error inesperado: ${err.message}`);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!value) return;

    // Extract the storage path from the public URL
    // URL format: .../storage/v1/object/public/item-photos/{path}
    const storagePath = value.split("/item-photos/")[1];

    if (storagePath) {
      const { error } = await supabase.storage
        .from("item-photos")
        .remove([storagePath]);

      if (error) {
        console.error("Failed to delete photo from storage:", error);
        // Still clear the value even if delete fails
        // so the UI does not get stuck showing a broken image
      }
    }

    onChange("");
  };

  // ─── FILE UPLOAD ──────────────────────────────────────────────────────────
  // Returns an icon emoji based on the file extension
  const getFileIcon = (filename) => {
    if (!filename) return "📄";
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "pdf")                          return "📕";
    if (["doc", "docx"].includes(ext))          return "📝";
    if (["xls", "xlsx"].includes(ext))          return "📊";
    if (["ppt", "pptx"].includes(ext))          return "📋";
    if (["zip", "rar", "7z"].includes(ext))     return "🗜️";
    if (["mp4", "mov", "avi"].includes(ext))    return "🎬";
    if (["mp3", "wav", "m4a"].includes(ext))    return "🎵";
    return "📄";
  };

  // Extracts the original filename from a Supabase storage URL
  // URL format: .../item-files/files/{catId}/{timestamp}-{originalName}
  const getFilenameFromUrl = (url) => {
    if (!url) return "";
    const parts = url.split("/");
    const raw = parts[parts.length - 1];
    // Strip the timestamp prefix (e.g. "1714000000000-contract.pdf" → "contract.pdf")
    const dashIndex = raw.indexOf("-");
    return dashIndex !== -1 ? raw.slice(dashIndex + 1) : raw;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 20 MB size limit — documents over this are unusual and expensive to store
    const MAX_SIZE_MB = 20;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`El archivo es demasiado grande. Máximo ${MAX_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    setFileUploading(true);
    setFileError(null);

    try {
      // Build a unique path inside the item-files bucket
      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `files/${cat.id}/${Date.now()}-${safeName}`;

      // Upload the file as-is (no compression for documents)
      const { error: uploadError } = await supabase.storage
        .from("item-files")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("File upload error:", uploadError);
        if (uploadError.statusCode === "404") {
          setFileError('Bucket no encontrado. Crea un bucket llamado "item-files" en Supabase Storage.');
        } else if (uploadError.statusCode === "403") {
          setFileError("Sin permiso para subir. Revisa las políticas RLS del bucket en Supabase.");
        } else {
          setFileError(`Error al subir: ${uploadError.message}`);
        }
        return;
      }

      // Get the public URL and save it as the category value
      const { data } = supabase.storage
        .from("item-files")
        .getPublicUrl(filePath);

      onChange(data.publicUrl);

    } catch (err) {
      console.error("Unexpected file upload error:", err);
      setFileError(`Error inesperado: ${err.message}`);
    } finally {
      setFileUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveFile = async () => {
    if (!value) return;

    // Extract the storage path from the public URL
    // URL format: .../storage/v1/object/public/item-files/{path}
    const storagePath = value.split("/item-files/")[1];

    if (storagePath) {
      const { error } = await supabase.storage
        .from("item-files")
        .remove([storagePath]);

      if (error) {
        console.error("Failed to delete file from storage:", error);
        // Still clear the value even if delete fails
      }
    }

    onChange("");
  };
  // ──────────────────────────────────────────────────────────────────────────

  const renderInput = () => {
    if (cat.type === "date") {
      return (
        <input
          type="date"
          value={value || ""}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
      );
    }

    if (cat.type === "schedule") {
      return (
        <input
          type="datetime-local"
          value={value || ""}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
      );
    }

    if (cat.type === "lead") {
      return (
        <div className="lead-selector">
          <button
            className="lead-choose-btn"
            disabled={locked}
            onClick={() => !locked && setOpenLeadMenu(prev => !prev)}
          >
            {value || "Elegir"}
          </button>
          {openLeadMenu && !locked && (
            <div className="lead-dropdown">
              {LEAD_OPTIONS.map(opt => (
                <div key={opt} className="lead-option"
                  onClick={() => { onChange(opt); setOpenLeadMenu(false); }}>
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (cat.type === "custom") {
      return (
        <div className="lead-selector">
          <button
            className="lead-choose-btn"
            disabled={locked}
            onClick={() => !locked && setOpenCustomMenu(prev => !prev)}
          >
            {value || "Elegir"}
          </button>
          {openCustomMenu && !locked && (
            <div className="lead-dropdown">
              {customOptions.length === 0 && (
                <div className="lead-option" style={{ color: "#999", fontStyle: "italic" }}>
                  Sin opciones
                </div>
              )}
              {customOptions.map(opt => (
                <div key={opt.id} className="lead-option"
                  onClick={() => { onChange(opt.label); setOpenCustomMenu(false); }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ── PHOTO TYPE ────────────────────────────────────────────────
    if (cat.type === "photo") {
      return (
        <div className="photo-field">

          {value ? (
            <div className="photo-preview">
              {/* Clicking the thumbnail opens fullscreen */}
              <img
                src={value}
                alt="Foto del elemento"
                onClick={() => setPhotoFullscreen(true)}
                style={{
                  maxWidth: "100%",
                  maxHeight: "260px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  display: "block",
                  marginBottom: "8px",
                  cursor: "zoom-in"
                }}
              />
              {!locked && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading ? "Subiendo..." : "Cambiar foto"}
                  </button>
                  <button
                    className="btn-delete"
                    onClick={handleRemovePhoto}
                    disabled={photoUploading}
                  >
                    Quitar foto
                  </button>
                </div>
              )}
            </div>
          ) : (
            !locked && (
              <button
                className="btn"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                style={{ marginTop: "4px" }}
              >
                {photoUploading ? "Subiendo..." : "📷 Subir foto"}
              </button>
            )
          )}

          {/* Error message */}
          {photoError && (
            <p style={{ color: "red", fontSize: "0.8rem", marginTop: "4px" }}>
              {photoError}
            </p>
          )}

          {/* Hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoChange}
          />

          {/* ── FULLSCREEN OVERLAY ────────────────────────────────── */}
          {photoFullscreen && (
            <div
              onClick={() => setPhotoFullscreen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0, 0, 0, 0.92)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px"
              }}
            >
              {/* Close button top-right */}
              <button
                onClick={() => setPhotoFullscreen(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "20px",
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  fontSize: "1.2rem",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>

              {/* Full size photo — clicking the photo itself doesn't close */}
              <img
                src={value}
                alt="Foto ampliada"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "100%",
                  maxHeight: "90vh",
                  borderRadius: "10px",
                  objectFit: "contain",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.6)"
                }}
              />

              <p style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "0.8rem",
                marginTop: "16px"
              }}>
                Toca fuera de la foto para cerrar
              </p>
            </div>
          )}
          {/* ───────────────────────────────────────────────────────── */}

        </div>
      );
    }
    // ─────────────────────────────────────────────────────────────

    // ── FILE TYPE ─────────────────────────────────────────────────
    if (cat.type === "file") {
      const filename = getFilenameFromUrl(value);
      const icon     = getFileIcon(filename);

      return (
        <div className="file-field">

          {value ? (
            // File is uploaded — show icon, name, open and remove buttons
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: "var(--bg-secondary, #f5f5f5)",
              borderRadius: "8px",
              flexWrap: "wrap"
            }}>
              <span style={{ fontSize: "1.4rem" }}>{icon}</span>

              {/* Filename — clicking it opens the file in a new tab */}
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  fontSize: "0.875rem",
                  wordBreak: "break-all",
                  color: "var(--color-primary, #1a73e8)",
                  textDecoration: "none"
                }}
              >
                {filename}
              </a>

              {/* Open button */}
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ textDecoration: "none", fontSize: "0.8rem" }}
              >
                Abrir
              </a>

              {/* Replace / remove buttons — only when unlocked */}
              {!locked && (
                <>
                  <button
                    className="btn"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUploading}
                  >
                    {fileUploading ? "Subiendo..." : "Cambiar"}
                  </button>
                  <button
                    className="btn-delete"
                    style={{ fontSize: "0.8rem" }}
                    onClick={handleRemoveFile}
                    disabled={fileUploading}
                  >
                    Quitar
                  </button>
                </>
              )}
            </div>
          ) : (
            // No file yet — show upload button
            !locked && (
              <button
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
                style={{ marginTop: "4px" }}
              >
                {fileUploading ? "Subiendo..." : "📎 Subir archivo"}
              </button>
            )
          )}

          {/* Error message */}
          {fileError && (
            <p style={{ color: "red", fontSize: "0.8rem", marginTop: "6px" }}>
              {fileError}
            </p>
          )}

          {/* Hidden file input — accepts all file types */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

        </div>
      );
    }
    // ─────────────────────────────────────────────────────────────

    // "own" type — auto-resizing textarea (default)
    return (
      <textarea
        ref={textareaRef}
        value={value || ""}
        readOnly={locked}
        onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
        className="input auto-textarea"
      />
    );
  };

  const hasAnyButton =
    (canRename && !editingTitle) ||
    (mode === "create" || (mode === "edit" && !cat.is_global)) ||
    canEditType ||
    (cat.type === "custom" && canEditType && !locked);

  return (
    <div className="category-input-row">

      {/* LABEL + BUTTONS */}
      <div className="category-header">
        {editingTitle ? (
          <input
            autoFocus
            className="input category-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleRenameSave}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <div className="category-label-row">
            <label>{cat.title}</label>
            {hasAnyButton && (
              <button
                className="btn-toggle-actions"
                onClick={() => setShowButtons(prev => !prev)}
                title="Opciones"
              >
                {showButtons ? "✕" : "⋯"}
              </button>
            )}
          </div>
        )}

        {showButtons && !editingTitle && (
          <div className="category-header-buttons">
            {canRename && (
              <button className="btn-rename"
                onClick={() => { setEditingTitle(true); setShowButtons(false); }}
                title="Renombrar categoría">
                ✏️
              </button>
            )}
            {(mode === "create" || (mode === "edit" && !cat.is_global)) && (
              <button className="btn-delete" onClick={onDelete}>🗑</button>
            )}
            {canEditType && (
              <button className="type-arrow" onClick={() => setOpenTypeMenu(prev => !prev)}>
                ⬇
              </button>
            )}
            {cat.type === "custom" && canEditType && !locked && (
              <button className="btn" style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                onClick={() => setShowCustomManager(prev => !prev)}
                title="Administrar opciones">
                ⚙️
              </button>
            )}
          </div>
        )}

        {openTypeMenu && canEditType && (
          <div className="type-dropdown">
            {CATEGORY_TYPE_OPTIONS.map(opt => (
              <div key={opt.value} className="type-option"
                onClick={() => updateCategoryType(opt.value)}>
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CUSTOM OPTIONS MANAGER */}
      {cat.type === "custom" && showCustomManager && canEditType && (
        <div className="custom-options-manager">
          <div className="custom-options-list">
            {customOptions.length === 0 && (
              <span style={{ color: "#999", fontSize: "0.85rem", fontStyle: "italic" }}>
                Sin opciones aún
              </span>
            )}
            {customOptions.map(opt => (
              <div key={opt.id} className="custom-option-row">
                <span>{opt.label}</span>
                <button className="btn-delete" onClick={() => handleDeleteOption(opt.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="custom-option-add-row">
            <input
              className="input"
              placeholder="Nueva opción..."
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); }}}
            />
            <button className="btn" onClick={handleAddOption}>+</button>
          </div>
        </div>
      )}

      {/* INPUT */}
      {renderInput()}

    </div>
  );
}