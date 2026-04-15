export default function Layout({ children, currentPage, setCurrentPage, onLogout }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f5" }}>
      
      {/* Sidebar */}
      <div style={{
        width: 220,
        background: "#111827",
        color: "white",
        padding: 20
      }}>
        <h2 style={{ marginBottom: 20 }}>EIKO</h2>

        {[
          ["dashboard", "Dashboard"],
          ["products", "Productos"],
          ["customers", "Clientes"],
          ["quotes", "Cotizaciones"],
          ["sales", "Ventas"],
          ["expenses", "Gastos"],
          ["team", "Equipo"],
          ["audit", "Auditoría"]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCurrentPage(key)}
            style={{
              width: "100%",
              marginBottom: 8,
              padding: 10,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: currentPage === key ? "#facc15" : "transparent",
              color: currentPage === key ? "#000" : "#fff",
              fontWeight: "bold"
            }}
          >
            {label}
          </button>
        ))}

        <hr style={{ margin: "20px 0", borderColor: "#333" }} />

        <button
          onClick={onLogout}
          style={{
            width: "100%",
            padding: 10,
            background: "crimson",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer"
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: 20 }}>
        {children}
      </div>

    </div>
  );
}