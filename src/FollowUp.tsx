import { FormEvent, useState } from "react";
import "./follow-up.css";

export default function FollowUp({ token, lead, mode, close, saved }: { token: string; lead: { id: number; nombre: string }; mode: "reschedule" | "follow-up"; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reschedule = mode === "reschedule";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/contact-update", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, id: lead.id, action: mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la gestión.");
      saved();
      close();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo conectar."); }
    finally { setBusy(false); }
  };
  return <div className="modal follow-up-modal"><form className="new-contact action-form" onSubmit={submit}>
    <button className="modal-close" type="button" disabled={busy} onClick={close} aria-label="Cerrar">×</button>
    <h2>{reschedule ? "Reprogramar contacto" : "Marcar accionado"}</h2>
    <p>{lead.nombre}</p>
    {reschedule ? <label>Nueva fecha de contacto<input type="date" name="nextContact" min={minDate} required disabled={busy}/></label> : <label>¿Qué acción realizaste?<textarea name="newComment" rows={4} required disabled={busy} placeholder="Contá brevemente cómo gestionaste este contacto."/></label>}
    {!reschedule && <p>El comentario quedará en el historial y se quitará la fecha pendiente.</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? "Guardando…" : reschedule ? "Guardar nueva fecha" : "Guardar acción"}</button>
  </form></div>;
}
