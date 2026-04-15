export default function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <div style={{ padding: 10 }}>
      {[
        ["dashboard", "Dashboard"],
        ["products", "Productos"],
        ["customers", "Clientes"],
        ["quotes", "Cotizaciones"],
        ["sales", "Ventas"],
        ["expenses", "Gastos"]
      ].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setCurrentPage(key)}
          style={{
            display: "block",
            width: "100%",
            marginBottom: 6,
            padding: 8
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}