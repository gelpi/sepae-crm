import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Estado = "Nuevo" | "Contactado" | "Seguimiento" | "Cerrado";

type Contacto = {
  id: number;
  nombre: string;
  telefono: string;
  vendedora: string;
  origen: string;
  comentario: string;
  estado: Estado;
  fecha: string;
};

const contactos: Contacto[] = [
  { id: 1, nombre: "María González", telefono: "099 123 456", vendedora: "Marianela", origen: "Llamado telefónico", comentario: "Pidió información sobre la cobertura familiar.", estado: "Nuevo", fecha: "Hoy, 10:35" },
  { id: 2, nombre: "Carlos Rodríguez", telefono: "098 765 432", vendedora: "Mercedes", origen: "Referencia", comentario: "Quiere recibir la propuesta por WhatsApp.", estado: "Nuevo", fecha: "Hoy, 09:12" },
  { id: 3, nombre: "Andrea Silva", telefono: "091 244 780", vendedora: "Marianela", origen: "Redes sociales", comentario: "Consultó por el plan para su madre.", estado: "Contactado", fecha: "Ayer" },
  { id: 4, nombre: "Jorge Pereira", telefono: "092 444 510", vendedora: "Mercedes", origen: "Oficina", comentario: "Enviar opciones de afiliación el viernes.", estado: "Seguimiento", fecha: "11 jul" },
  { id: 5, nombre: "Lucía Martínez", telefono: "097 580 091", vendedora: "Marianela", origen: "Llamado telefónico", comentario: "Interesada en comenzar este mes.", estado: "Cerrado", fecha: "10 jul" },
];

const estados: Estado[] = ["Nuevo", "Contactado", "Seguimiento", "Cerrado"];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>SEPAE</span></div>
        <nav>
          <a className="nav-active" href="#inicio">⌂ <span>Inicio</span></a>
          <a href="#contactos">◉ <span>Contactos</span></a>
          <a href="#pipeline">↗ <span>Pipeline</span></a>
          <a href="#reportes">▥ <span>Reportes</span></a>
        </nav>
        <div className="sidebar-footer"><div className="avatar">M</div><div><strong>Marianela</strong><small>Equipo comercial</small></div></div>
      </aside>
      <main>
        <header><div><p className="eyebrow">MARTES, 14 DE JULIO</p><h1>Buen día, Marianela</h1><p className="subtle">Este es el resumen de tu actividad comercial.</p></div><button className="primary">＋ Nuevo contacto</button></header>
        <section className="metrics" aria-label="Resumen comercial">
          <Metric label="Nuevos contactos" value="18" note="↑ 12% esta semana" />
          <Metric label="Para contactar hoy" value="7" note="2 vencen hoy" emphasis />
          <Metric label="En seguimiento" value="24" note="8 con próxima acción" />
          <Metric label="Cierres del mes" value="11" note="↑ 3 vs. mes anterior" />
        </section>
        <section className="section-heading" id="contactos"><div><h2>Contactos recientes</h2><p>Priorizá los próximos seguimientos.</p></div><button className="secondary">Ver todos →</button></section>
        <section className="contact-list">
          {contactos.map((contacto) => <article className="contact" key={contacto.id}><div className="contact-avatar">{contacto.nombre.split(" ").map((p) => p[0]).join("")}</div><div className="contact-main"><div className="contact-title"><h3>{contacto.nombre}</h3><span className={`pill pill-${contacto.estado.toLowerCase()}`}>{contacto.estado}</span></div><p>{contacto.telefono} <span>·</span> {contacto.origen}</p><small>{contacto.comentario}</small></div><div className="contact-meta"><strong>{contacto.vendedora}</strong><small>{contacto.fecha}</small></div><button className="more" aria-label={`Acciones para ${contacto.nombre}`}>•••</button></article>)}
        </section>
        <section className="section-heading pipeline-heading" id="pipeline"><div><h2>Pipeline comercial</h2><p>Vista rápida de tus oportunidades.</p></div></section>
        <section className="pipeline">
          {estados.map((estado) => <div className="pipeline-column" key={estado}><div className="pipeline-title"><span>{estado}</span><b>{contactos.filter((c) => c.estado === estado).length}</b></div>{contactos.filter((c) => c.estado === estado).map((c) => <div className="deal" key={c.id}><strong>{c.nombre}</strong><span>{c.origen}</span></div>)}</div>)}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, note, emphasis = false }: { label: string; value: string; note: string; emphasis?: boolean }) {
  return <article className={`metric ${emphasis ? "metric-emphasis" : ""}`}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
