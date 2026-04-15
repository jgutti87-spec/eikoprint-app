export default function Sidebar({ currentPage, setCurrentPage, onLogout }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "products", label: "Productos", icon: "📦" },
    { key: "customers", label: "Clientes", icon: "👥" },
    { key: "quotes", label: "Cotizaciones", icon: "🧾" },
    { key: "sales", label: "Ventas", icon: "💰" },
    { key: "expenses", label: "Gastos", icon: "💸" },
    { key: "team", label: "Equipo", icon: "🧑‍💼" },
    { key: "audit", label: "Auditoría", icon: "🛡️" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-badge">E</div>
        <div>
          <h2>EIKO PRINT</h2>
          <p>Sistema de gestión</p>
        </div>
      </div>

      <div className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setCurrentPage(item.key)}
            className={`sidebar-link ${currentPage === item.key ? "active" : ""}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-button">
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}