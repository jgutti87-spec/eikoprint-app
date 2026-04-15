import Sidebar from "./Sidebar";

export default function Layout({ currentPage, setCurrentPage, onLogout, children }) {
  return (
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onLogout={onLogout}
      />

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}