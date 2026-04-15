import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import supabase from "./lib/supabase";
import Layout from "./components/Layout";
import Sidebar from "./components/Sidebar";

const emptyProductForm = {
  name: "",
  category: "",
  unit: "unidad",
  stock: "",
  min_stock: "",
  cost: "",
  price: "",
};

const emptySupplierForm = {
  name: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyPurchaseForm = {
  product_id: "",
  supplier_id: "",
  quantity: "",
  unit_cost: "",
  notes: "",
};

const emptyMovementForm = {
  product_id: "",
  movement_type: "entrada",
  quantity: "",
  notes: "",
};

const emptyCustomerForm = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const emptyExpenseForm = {
  concept: "",
  category: "",
  amount: "",
  notes: "",
};

const emptyQuoteItem = {
  product_id: "",
  description: "",
  quantity: 1,
  unit_price: "",
};

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;
  return digits;
}

function csvSafe(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value).replace(/"/g, '""');
  return String(value).replace(/"/g, '""');
}

export default function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dateFilter, setDateFilter] = useState("all");

  const [business, setBusiness] = useState({
    id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    ruc: "",
    iva_percent: 15,
    logo_url: "",
  });

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [sales, setSales] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const [editingProductId, setEditingProductId] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [productForm, setProductForm] = useState(emptyProductForm);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

  const [quoteForm, setQuoteForm] = useState({
    customer_id: "",
    notes: "",
    includeIva: false,
    ivaRate: 15,
    discountPercent: 0,
  });

  const [quoteItems, setQuoteItems] = useState([{ ...emptyQuoteItem }]);
  const [paymentForms, setPaymentForms] = useState({});

  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProducts([]);
      setSuppliers([]);
      setPurchases([]);
      setPayments([]);
      setInventoryMovements([]);
      setCustomers([]);
      setExpenses([]);
      setQuotes([]);
      setSales([]);
      setProfiles([]);
      setAuditLogs([]);
      setCurrentUserProfile(null);
      return;
    }

    loadBusiness();
    loadCurrentUserProfile();
    loadProducts();
    loadSuppliers();
    loadPurchases();
    loadPayments();
    loadInventoryMovements();
    loadCustomers();
    loadExpenses();
    loadQuotes();
    loadSales();
    loadProfiles();
    loadAuditLogs();
  }, [session]);

  useEffect(() => {
    if (business?.iva_percent && !editingQuoteId) {
      setQuoteForm((prev) => ({
        ...prev,
        ivaRate: Number(business.iva_percent || 15),
      }));
    }
  }, [business?.iva_percent, editingQuoteId]);

  const role = currentUserProfile?.role || "employee";
  const canEdit = role === "admin" || role === "secretary";
  const canDelete = role === "admin" || role === "secretary";
  const canManageTeam = role === "admin";
  const canViewAudit = role === "admin";

  function exportToCSV(filename, rows) {
    if (!rows || rows.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((field) => `"${csvSafe(row[field])}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportSalesCSV() {
    const rows = sales.map((sale) => ({
      numero: sale.sale_number,
      cliente: sale.customers?.full_name || "",
      telefono: sale.customers?.phone || "",
      estado: sale.status,
      subtotal: sale.subtotal,
      descuento: sale.discount,
      total: sale.total,
      pagado: sale.amount_paid,
      pendiente: sale.amount_due,
      fecha: sale.created_at,
    }));
    exportToCSV("ventas.csv", rows);
  }

  function exportCustomersCSV() {
    const rows = customers.map((customer) => ({
      nombre: customer.full_name,
      telefono: customer.phone,
      correo: customer.email,
      direccion: customer.address,
      notas: customer.notes,
      fecha: customer.created_at,
    }));
    exportToCSV("clientes.csv", rows);
  }

  function exportProductsCSV() {
    const rows = products.map((product) => ({
      nombre: product.name,
      categoria: product.category,
      unidad: product.unit,
      stock: product.stock,
      stock_minimo: product.min_stock,
      costo: product.cost,
      precio: product.price,
      utilidad_unitaria: Number(product.price || 0) - Number(product.cost || 0),
      fecha: product.created_at,
    }));
    exportToCSV("productos.csv", rows);
  }

  function exportExpensesCSV() {
    const rows = expenses.map((expense) => ({
      concepto: expense.concept,
      categoria: expense.category,
      monto: expense.amount,
      notas: expense.notes,
      fecha: expense.created_at,
    }));
    exportToCSV("gastos.csv", rows);
  }

  function exportReceivablesCSV() {
    const rows = receivables.map((sale) => ({
      numero: sale.sale_number,
      cliente: sale.customers?.full_name || "",
      telefono: sale.customers?.phone || "",
      total: sale.total,
      pagado: sale.amount_paid,
      pendiente: sale.amount_due,
      estado: sale.status,
      fecha: sale.created_at,
    }));
    exportToCSV("cuentas-por-cobrar.csv", rows);
  }

  function exportPurchasesCSV() {
    const rows = purchases.map((purchase) => ({
      producto: purchase.products?.name || "",
      proveedor: purchase.suppliers?.name || purchase.supplier_name || "",
      cantidad: purchase.quantity,
      costo_unitario: purchase.unit_cost,
      total_compra: purchase.total_cost,
      notas: purchase.notes,
      fecha: purchase.created_at,
    }));
    exportToCSV("compras.csv", rows);
  }

  function downloadBackup() {
    exportCustomersCSV();
    exportProductsCSV();
    exportSalesCSV();
    exportExpensesCSV();
    exportReceivablesCSV();
    exportPurchasesCSV();
  }

  function isInRange(dateString) {
    if (!dateString) return false;
    if (dateFilter === "all") return true;

    const itemDate = new Date(dateString);
    const now = new Date();

    if (dateFilter === "day") {
      return itemDate.toDateString() === now.toDateString();
    }

    if (dateFilter === "week") {
      const diffMs = now - itemDate;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }

    if (dateFilter === "month") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  }

  async function loadBusiness() {
    const { data, error } = await supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      setBusiness({
        id: data.id,
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        ruc: data.ruc || "",
        iva_percent: Number(data.iva_percent || 15),
        logo_url: data.logo_url || "",
      });
    }
  }

  async function handleSaveBusiness(e) {
    e.preventDefault();
    setError("");

    if (business.id) {
      const { error } = await supabase
        .from("business_settings")
        .update({
          name: business.name,
          phone: business.phone,
          email: business.email,
          address: business.address,
          ruc: business.ruc,
          iva_percent: Number(business.iva_percent || 15),
          logo_url: business.logo_url,
        })
        .eq("id", business.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("business_settings")
        .insert([
          {
            name: business.name,
            phone: business.phone,
            email: business.email,
            address: business.address,
            ruc: business.ruc,
            iva_percent: Number(business.iva_percent || 15),
            logo_url: business.logo_url,
          },
        ])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      setBusiness((prev) => ({ ...prev, id: data.id }));
    }

    await logAudit("update", "business", business.id || "settings", "Actualizó configuración del negocio");
    alert("Configuración guardada");
    loadBusiness();
  }

  async function loadCurrentUserProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    if (data && data.is_active === false) {
      alert("Tu usuario está inactivo. Contacta al administrador.");
      await supabase.auth.signOut();
      return;
    }

    setCurrentUserProfile(data);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setProfiles(data || []);
  }

  async function loadAuditLogs() {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setError(error.message);
      return;
    }

    setAuditLogs(data || []);
  }

  async function logAudit(actionType, entityType, entityId, description, metadata = {}) {
    try {
      await supabase.from("audit_logs").insert([
        {
          actor_user_id: session.user.id,
          actor_name:
            currentUserProfile?.full_name ||
            currentUserProfile?.email ||
            session.user.email ||
            "Usuario",
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId ? String(entityId) : null,
          description,
          metadata,
        },
      ]);
      loadAuditLogs();
    } catch {
      // no romper flujo
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadPurchases() {
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        products (
          name
        ),
        suppliers (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      return;
    }

    setPurchases(data || []);
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        sales (
          sale_number,
          customer_id,
          customers (
            full_name,
            phone
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      return;
    }

    setPayments(data || []);
  }

  async function loadInventoryMovements() {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select(`
        *,
        products (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError(error.message);
      return;
    }

    setInventoryMovements(data || []);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setCustomers(data || []);
  }

  async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setExpenses(data || []);
  }

  async function loadQuotes() {
    const { data, error } = await supabase
      .from("quotes")
      .select(`
        *,
        customers (
          full_name,
          phone,
          email,
          address
        ),
        quote_items (
          id,
          product_id,
          description,
          quantity,
          unit_price,
          subtotal,
          discount_percent,
          discount_amount,
          cost_snapshot,
          cost_total_snapshot
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setQuotes(data || []);
  }

  async function loadSales() {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        *,
        customers (
          full_name,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setSales(data || []);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });

    if (error) {
      setError(error.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function resetProductForm() {
    setProductForm(emptyProductForm);
    setEditingProductId(null);
  }

  function resetSupplierForm() {
    setSupplierForm(emptySupplierForm);
  }

  function resetPurchaseForm() {
    setPurchaseForm(emptyPurchaseForm);
  }

  function resetMovementForm(productId = "") {
    setMovementForm({
      product_id: productId,
      movement_type: "entrada",
      quantity: "",
      notes: "",
    });
  }

  function resetCustomerForm() {
    setCustomerForm(emptyCustomerForm);
    setEditingCustomerId(null);
  }

  function resetExpenseForm() {
    setExpenseForm(emptyExpenseForm);
    setEditingExpenseId(null);
  }

  function resetQuoteForm() {
    setQuoteForm({
      customer_id: "",
      notes: "",
      includeIva: false,
      ivaRate: Number(business.iva_percent || 15),
      discountPercent: 0,
    });
    setQuoteItems([{ ...emptyQuoteItem }]);
    setEditingQuoteId(null);
  }

  function addQuoteItem() {
    setQuoteItems((prev) => [...prev, { ...emptyQuoteItem }]);
  }

  function removeQuoteItem(index) {
    setQuoteItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateQuoteItem(index, field, value) {
    setQuoteItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const updated = { ...item, [field]: value };

        if (field === "product_id") {
          const selectedProduct = products.find((p) => p.id === value);
          if (selectedProduct) {
            updated.description = selectedProduct.name || "";
            updated.unit_price = selectedProduct.price ?? "";
          }
        }

        return updated;
      })
    );
  }

  const quoteSummary = useMemo(() => {
    const cleanItems = quoteItems.filter(
      (item) =>
        item.description.trim() !== "" &&
        Number(item.quantity || 0) > 0 &&
        Number(item.unit_price || 0) >= 0
    );

    const subtotal = cleanItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    );

    const discountPercent = Number(quoteForm.discountPercent || 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;

    const ivaAmount = quoteForm.includeIva
      ? subtotalAfterDiscount * (Number(quoteForm.ivaRate || 0) / 100)
      : 0;

    return {
      cleanItems,
      subtotal,
      discountPercent,
      discountAmount,
      subtotalAfterDiscount,
      ivaAmount,
      total: subtotalAfterDiscount + ivaAmount,
    };
  }, [
    quoteItems,
    quoteForm.includeIva,
    quoteForm.ivaRate,
    quoteForm.discountPercent,
  ]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    if (!term) return products;

    return products.filter((product) =>
      [
        product.name,
        product.category,
        product.unit,
        String(product.stock),
        String(product.price),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [products, productSearch]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.toLowerCase().trim();
    if (!term) return customers;

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.phone,
        customer.email,
        customer.address,
        customer.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [customers, customerSearch]);

  const filteredSales = useMemo(() => {
    const term = saleSearch.toLowerCase().trim();
    const base = sales.filter((sale) => isInRange(sale.created_at));
    if (!term) return base;

    return base.filter((sale) =>
      [
        sale.sale_number,
        sale.status,
        sale.notes,
        sale.customers?.full_name,
        String(sale.total),
        String(sale.amount_paid),
        String(sale.amount_due),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [sales, saleSearch, dateFilter]);

  const filteredAuditLogs = useMemo(() => {
    const term = auditSearch.toLowerCase().trim();
    if (!term) return auditLogs;

    return auditLogs.filter((log) =>
      [
        log.actor_name,
        log.action_type,
        log.entity_type,
        log.entity_id,
        log.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [auditLogs, auditSearch]);

  const filteredQuotesByDate = useMemo(
    () => quotes.filter((quote) => isInRange(quote.created_at)),
    [quotes, dateFilter]
  );

  const filteredExpensesByDate = useMemo(
    () => expenses.filter((expense) => isInRange(expense.created_at)),
    [expenses, dateFilter]
  );

  const filteredPurchasesByDate = useMemo(
    () => purchases.filter((purchase) => isInRange(purchase.created_at)),
    [purchases, dateFilter]
  );

  const receivables = useMemo(
    () => filteredSales.filter((sale) => Number(sale.amount_due || 0) > 0),
    [filteredSales]
  );

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (product) => Number(product.stock || 0) <= Number(product.min_stock || 0)
      ),
    [products]
  );

  const exactCostOfSales = useMemo(() => {
    return filteredQuotesByDate
      .filter((quote) => quote.status === "facturada")
      .reduce((sum, quote) => {
        const items = quote.quote_items || [];
        const quoteCost = items.reduce(
          (acc, item) => acc + Number(item.cost_total_snapshot || 0),
          0
        );
        return sum + quoteCost;
      }, 0);
  }, [filteredQuotesByDate]);

  const dashboardFinancial = useMemo(() => {
    const totalSold = filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalPaid = filteredSales.reduce((sum, sale) => sum + Number(sale.amount_paid || 0), 0);
    const totalDue = filteredSales.reduce((sum, sale) => sum + Number(sale.amount_due || 0), 0);
    const totalExpenseAmount = filteredExpensesByDate.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const totalPurchases = filteredPurchasesByDate.reduce(
      (sum, item) => sum + Number(item.total_cost || 0),
      0
    );
    const exactProfit = totalSold - exactCostOfSales - totalExpenseAmount;

    return {
      totalSold,
      totalPaid,
      totalDue,
      totalExpenseAmount,
      totalPurchases,
      exactCostOfSales,
      exactProfit,
      realBalance: totalPaid - totalExpenseAmount,
    };
  }, [filteredSales, filteredExpensesByDate, filteredPurchasesByDate, exactCostOfSales]);

  const profitByProduct = useMemo(() => {
    const stats = {};

    filteredQuotesByDate
      .filter((quote) => quote.status === "facturada")
      .forEach((quote) => {
        (quote.quote_items || []).forEach((item) => {
          const key = item.product_id || item.description;

          if (!stats[key]) {
            stats[key] = {
              name: item.description || "Producto",
              quantity: 0,
              revenue: 0,
              cost: 0,
              profit: 0,
            };
          }

          const qty = Number(item.quantity || 0);
          const revenue = Number(item.subtotal || 0);
          const cost = Number(item.cost_total_snapshot || 0);

          stats[key].quantity += qty;
          stats[key].revenue += revenue;
          stats[key].cost += cost;
          stats[key].profit += revenue - cost;
        });
      });

    return Object.values(stats)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [filteredQuotesByDate]);

  const paymentsBySaleId = useMemo(() => {
    const grouped = {};
    payments.forEach((payment) => {
      const saleId = payment.sale_id;
      if (!grouped[saleId]) grouped[saleId] = [];
      grouped[saleId].push(payment);
    });
    return grouped;
  }, [payments]);

  const chartData = useMemo(() => {
    const map = {};

    filteredSales.forEach((sale) => {
      const date = new Date(sale.created_at).toLocaleDateString();
      if (!map[date]) {
        map[date] = { date, ventas: 0, gastos: 0 };
      }
      map[date].ventas += Number(sale.total || 0);
    });

    filteredExpensesByDate.forEach((exp) => {
      const date = new Date(exp.created_at).toLocaleDateString();
      if (!map[date]) {
        map[date] = { date, ventas: 0, gastos: 0 };
      }
      map[date].gastos += Number(exp.amount || 0);
    });

    const result = Object.values(map);
    return result.length > 0 ? result : [{ date: "Sin datos", ventas: 0, gastos: 0 }];
  }, [filteredSales, filteredExpensesByDate]);

  function buildQuoteWhatsappLink(quote) {
    const phone = normalizePhone(quote.customers?.phone);
    if (!phone) return null;

    const message =
      `Hola ${quote.customers?.full_name || ""}, te comparto tu cotización ${quote.quote_number}. ` +
      `Total: $${Number(quote.total || 0).toFixed(2)}. ` +
      `Gracias por preferir ${business.name || "EIKO PRINT"}.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function buildReceivableWhatsappLink(sale) {
    const phone = normalizePhone(sale.customers?.phone);
    if (!phone) return null;

    const message =
      `Hola ${sale.customers?.full_name || ""}, te escribimos por tu saldo pendiente de la venta ${sale.sale_number}. ` +
      `Pendiente: $${Number(sale.amount_due || 0).toFixed(2)}.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    setError("");

    const payload = {
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit || "unidad",
      stock: Number(productForm.stock || 0),
      min_stock: Number(productForm.min_stock || 0),
      cost: Number(productForm.cost || 0),
      price: Number(productForm.price || 0),
      is_active: true,
    };

    if (editingProductId) {
      if (!canEdit) {
        setError("Tu rol no puede editar productos");
        return;
      }

      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingProductId);

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("update", "product", editingProductId, `Actualizó producto ${productForm.name}`, payload);
      setEditingProductId(null);
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert([payload])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("create", "product", data?.id, `Creó producto ${productForm.name}`, payload);
    }

    resetProductForm();
    loadProducts();
  }

  async function handleCreateSupplier(e) {
    e.preventDefault();
    setError("");

    const { data, error } = await supabase
      .from("suppliers")
      .insert([
        {
          name: supplierForm.name,
          phone: supplierForm.phone,
          email: supplierForm.email,
          notes: supplierForm.notes,
        },
      ])
      .select()
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("create", "supplier", data?.id, `Creó proveedor ${supplierForm.name}`);
    resetSupplierForm();
    loadSuppliers();
  }

  async function handleCreatePurchase(e) {
    e.preventDefault();
    setError("");

    const product = products.find((p) => p.id === purchaseForm.product_id);
    const supplier = suppliers.find((s) => s.id === purchaseForm.supplier_id);

    if (!product) {
      setError("Selecciona un producto");
      return;
    }

    const quantity = Number(purchaseForm.quantity || 0);
    const unitCost = Number(purchaseForm.unit_cost || 0);

    if (quantity <= 0 || unitCost < 0) {
      setError("Ingresa cantidad y costo válidos");
      return;
    }

    const totalCost = quantity * unitCost;
    const newStock = Number(product.stock || 0) + quantity;

    const { error: purchaseError } = await supabase.from("purchases").insert([
      {
        product_id: product.id,
        user_id: session.user.id,
        supplier_id: supplier?.id || null,
        supplier_name: supplier?.name || "",
        quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: purchaseForm.notes,
      },
    ]);

    if (purchaseError) {
      setError(purchaseError.message);
      return;
    }

    const { error: productUpdateError } = await supabase
      .from("products")
      .update({
        stock: newStock,
        cost: unitCost,
      })
      .eq("id", product.id);

    if (productUpdateError) {
      setError(productUpdateError.message);
      return;
    }

    const { error: movementError } = await supabase.from("inventory_movements").insert([
      {
        product_id: product.id,
        user_id: session.user.id,
        movement_type: "entrada",
        quantity,
        previous_stock: Number(product.stock || 0),
        new_stock: newStock,
        notes: `Compra${supplier?.name ? ` a ${supplier.name}` : ""}`,
      },
    ]);

    if (movementError) {
      setError(movementError.message);
      return;
    }

    await logAudit(
      "purchase",
      "purchase",
      product.id,
      `Registró compra de ${quantity} ${product.unit || "unidad"} de ${product.name} por $${totalCost.toFixed(2)}`,
      {
        supplier_name: supplier?.name || "",
        quantity,
        unitCost,
        totalCost,
      }
    );

    resetPurchaseForm();
    loadProducts();
    loadPurchases();
    loadInventoryMovements();
  }

  function handleEditProduct(product) {
    if (!canEdit) {
      setError("Tu rol no puede editar productos");
      return;
    }

    setProductForm({
      name: product.name || "",
      category: product.category || "",
      unit: product.unit || "unidad",
      stock: String(product.stock || ""),
      min_stock: String(product.min_stock || ""),
      cost: String(product.cost || ""),
      price: String(product.price || ""),
    });

    setEditingProductId(product.id);
    setCurrentPage("products");
  }

  async function handleDeleteProduct(id, name) {
    if (!canDelete) {
      setError("Tu rol no puede eliminar productos");
      return;
    }

    const confirmDelete = window.confirm("¿Eliminar este producto?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("delete", "product", id, `Eliminó producto ${name}`);
    loadProducts();
  }

  async function handleInventoryMovement(e) {
    e.preventDefault();
    setError("");

    const product = products.find((p) => p.id === movementForm.product_id);

    if (!product) {
      setError("Selecciona un producto");
      return;
    }

    const qty = Number(movementForm.quantity || 0);

    if (!qty || qty <= 0) {
      setError("Ingresa una cantidad válida");
      return;
    }

    const previousStock = Number(product.stock || 0);
    let newStock = previousStock;

    if (movementForm.movement_type === "entrada") {
      newStock = previousStock + qty;
    } else if (movementForm.movement_type === "salida") {
      newStock = previousStock - qty;
    } else if (movementForm.movement_type === "ajuste") {
      newStock = qty;
    }

    if (newStock < 0) {
      setError("No puedes dejar el stock en negativo");
      return;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", product.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { data: movementData, error: movementError } = await supabase
      .from("inventory_movements")
      .insert([
        {
          product_id: product.id,
          user_id: session.user.id,
          movement_type: movementForm.movement_type,
          quantity: qty,
          previous_stock: previousStock,
          new_stock: newStock,
          notes: movementForm.notes,
        },
      ])
      .select()
      .single();

    if (movementError) {
      setError(movementError.message);
      return;
    }

    await logAudit(
      "movement",
      "inventory",
      movementData?.id,
      `Registró movimiento ${movementForm.movement_type} de ${qty} en ${product.name}`,
      { previousStock, newStock, notes: movementForm.notes }
    );

    resetMovementForm();
    loadProducts();
    loadInventoryMovements();
  }

  function quickInventoryMovement(productId, movementType) {
    setMovementForm({
      product_id: productId,
      movement_type: movementType,
      quantity: "",
      notes: "",
    });
    setCurrentPage("products");
  }

  async function handleCreateCustomer(e) {
    e.preventDefault();
    setError("");

    if (editingCustomerId) {
      if (!canEdit) {
        setError("Tu rol no puede editar clientes");
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          full_name: customerForm.full_name,
          phone: customerForm.phone,
          email: customerForm.email,
          address: customerForm.address,
          notes: customerForm.notes,
        })
        .eq("id", editingCustomerId);

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("update", "customer", editingCustomerId, `Actualizó cliente ${customerForm.full_name}`);
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert([
          {
            full_name: customerForm.full_name,
            phone: customerForm.phone,
            email: customerForm.email,
            address: customerForm.address,
            notes: customerForm.notes,
          },
        ])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("create", "customer", data?.id, `Creó cliente ${customerForm.full_name}`);
    }

    resetCustomerForm();
    loadCustomers();
  }

  function handleEditCustomer(customer) {
    if (!canEdit) {
      setError("Tu rol no puede editar clientes");
      return;
    }

    setCustomerForm({
      full_name: customer.full_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });

    setEditingCustomerId(customer.id);
    setCurrentPage("customers");
  }

  async function handleDeleteCustomer(id, name) {
    if (!canDelete) {
      setError("Tu rol no puede eliminar clientes");
      return;
    }

    const confirmDelete = window.confirm("¿Eliminar este cliente?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("delete", "customer", id, `Eliminó cliente ${name}`);
    loadCustomers();
  }

  async function handleCreateExpense(e) {
    e.preventDefault();
    setError("");

    if (editingExpenseId) {
      if (!canEdit) {
        setError("Tu rol no puede editar gastos");
        return;
      }

      const { error } = await supabase
        .from("expenses")
        .update({
          concept: expenseForm.concept,
          category: expenseForm.category,
          amount: Number(expenseForm.amount || 0),
          notes: expenseForm.notes,
        })
        .eq("id", editingExpenseId);

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("update", "expense", editingExpenseId, `Actualizó gasto ${expenseForm.concept}`);
    } else {
      const { data, error } = await supabase
        .from("expenses")
        .insert([
          {
            user_id: session.user.id,
            concept: expenseForm.concept,
            category: expenseForm.category,
            amount: Number(expenseForm.amount || 0),
            notes: expenseForm.notes,
          },
        ])
        .select()
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      await logAudit("create", "expense", data?.id, `Creó gasto ${expenseForm.concept}`);
    }

    resetExpenseForm();
    loadExpenses();
  }

  function handleEditExpense(expense) {
    if (!canEdit) {
      setError("Tu rol no puede editar gastos");
      return;
    }

    setExpenseForm({
      concept: expense.concept || "",
      category: expense.category || "",
      amount: String(expense.amount || ""),
      notes: expense.notes || "",
    });

    setEditingExpenseId(expense.id);
    setCurrentPage("expenses");
  }

  async function handleDeleteExpense(id, concept) {
    if (!canDelete) {
      setError("Tu rol no puede eliminar gastos");
      return;
    }

    const confirmDelete = window.confirm("¿Eliminar este gasto?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("delete", "expense", id, `Eliminó gasto ${concept}`);
    loadExpenses();
  }

  async function handleCreateQuote(e) {
    e.preventDefault();
    setError("");

    if (!quoteForm.customer_id) {
      setError("Selecciona un cliente");
      return;
    }

    if (quoteSummary.cleanItems.length === 0) {
      setError("Agrega al menos un ítem válido");
      return;
    }

    if (editingQuoteId) {
      if (!canEdit) {
        setError("Tu rol no puede editar cotizaciones");
        return;
      }

      const { error: quoteUpdateError } = await supabase
        .from("quotes")
        .update({
          customer_id: quoteForm.customer_id,
          subtotal: quoteSummary.subtotal,
          discount: quoteSummary.discountAmount,
          total: quoteSummary.total,
          notes: quoteForm.notes,
        })
        .eq("id", editingQuoteId);

      if (quoteUpdateError) {
        setError(quoteUpdateError.message);
        return;
      }

      const { error: deleteItemsError } = await supabase
        .from("quote_items")
        .delete()
        .eq("quote_id", editingQuoteId);

      if (deleteItemsError) {
        setError(deleteItemsError.message);
        return;
      }

      const itemsToInsert = quoteSummary.cleanItems.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const unitCost = Number(product?.cost || 0);
        const qty = Number(item.quantity || 0);

        return {
          quote_id: editingQuoteId,
          product_id: item.product_id || null,
          description: item.description,
          quantity: qty,
          unit_price: Number(item.unit_price || 0),
          subtotal: qty * Number(item.unit_price || 0),
          discount_percent: 0,
          discount_amount: 0,
          cost_snapshot: unitCost,
          cost_total_snapshot: unitCost * qty,
        };
      });

      const { error: insertItemsError } = await supabase
        .from("quote_items")
        .insert(itemsToInsert);

      if (insertItemsError) {
        setError(insertItemsError.message);
        return;
      }

      await logAudit("update", "quote", editingQuoteId, "Actualizó una cotización");

      resetQuoteForm();
      loadQuotes();
      return;
    }

    const quoteNumber = `COT-${Date.now()}`;

    const { data: insertedQuote, error: quoteError } = await supabase
      .from("quotes")
      .insert([
        {
          customer_id: quoteForm.customer_id,
          user_id: session.user.id,
          quote_number: quoteNumber,
          status: "pendiente",
          subtotal: quoteSummary.subtotal,
          discount: quoteSummary.discountAmount,
          total: quoteSummary.total,
          notes: quoteForm.notes,
        },
      ])
      .select()
      .single();

    if (quoteError) {
      setError(quoteError.message);
      return;
    }

    const itemsToInsert = quoteSummary.cleanItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      const unitCost = Number(product?.cost || 0);
      const qty = Number(item.quantity || 0);

      return {
        quote_id: insertedQuote.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: qty,
        unit_price: Number(item.unit_price || 0),
        subtotal: qty * Number(item.unit_price || 0),
        discount_percent: 0,
        discount_amount: 0,
        cost_snapshot: unitCost,
        cost_total_snapshot: unitCost * qty,
      };
    });

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemsToInsert);

    if (itemsError) {
      setError(itemsError.message);
      return;
    }

    await logAudit("create", "quote", insertedQuote?.id, `Creó cotización ${quoteNumber}`);

    resetQuoteForm();
    loadQuotes();
  }

  function handleEditQuote(quote) {
    if (!canEdit) {
      setError("Tu rol no puede editar cotizaciones");
      return;
    }

    const items = (quote.quote_items || []).map((item) => ({
      product_id: item.product_id || "",
      description: item.description || "",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || "",
    }));

    const subtotal = Number(quote.subtotal || 0);
    const discount = Number(quote.discount || 0);
    const total = Number(quote.total || 0);

    const subtotalAfterDiscount = subtotal - discount;
    const ivaIncluded = total > subtotalAfterDiscount;
    const ivaRate =
      ivaIncluded && subtotalAfterDiscount > 0
        ? Number((((total - subtotalAfterDiscount) / subtotalAfterDiscount) * 100).toFixed(2))
        : Number(business.iva_percent || 15);

    const discountPercent =
      subtotal > 0 ? Number(((discount / subtotal) * 100).toFixed(2)) : 0;

    setQuoteForm({
      customer_id: quote.customer_id || "",
      notes: quote.notes || "",
      includeIva: ivaIncluded,
      ivaRate: ivaRate || Number(business.iva_percent || 15),
      discountPercent: discountPercent || 0,
    });

    setQuoteItems(items.length > 0 ? items : [{ ...emptyQuoteItem }]);
    setEditingQuoteId(quote.id);
    setCurrentPage("quotes");
  }

  async function handleDeleteQuote(id, quoteNumber) {
    if (!canDelete) {
      setError("Tu rol no puede eliminar cotizaciones");
      return;
    }

    const confirmDelete = window.confirm("¿Eliminar esta cotización?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("delete", "quote", id, `Eliminó cotización ${quoteNumber}`);
    loadQuotes();
  }

  async function handleConvertQuoteToSale(quote) {
    setError("");

    const saleNumber = `VEN-${Date.now()}`;

    const { data: saleData, error: saleError } = await supabase
      .from("sales")
      .insert([
        {
          customer_id: quote.customer_id,
          user_id: session.user.id,
          quote_id: quote.id,
          sale_number: saleNumber,
          status: "pendiente",
          subtotal: Number(quote.subtotal || 0),
          discount: Number(quote.discount || 0),
          total: Number(quote.total || 0),
          amount_paid: 0,
          amount_due: Number(quote.total || 0),
          notes: quote.notes || "",
        },
      ])
      .select()
      .single();

    if (saleError) {
      setError(saleError.message);
      return;
    }

    const { error: quoteError } = await supabase
      .from("quotes")
      .update({ status: "facturada" })
      .eq("id", quote.id);

    if (quoteError) {
      setError(quoteError.message);
      return;
    }

    await logAudit(
      "convert",
      "sale",
      saleData?.id,
      `Convirtió cotización ${quote.quote_number} a venta ${saleNumber}`
    );

    loadQuotes();
    loadSales();
  }

  async function handleAddPayment(saleId) {
    setError("");

    const paymentAmount = Number(paymentForms[saleId] || 0);

    if (!paymentAmount || paymentAmount <= 0) {
      setError("Ingresa un monto válido");
      return;
    }

    const { data: paymentData, error } = await supabase
      .from("payments")
      .insert([
        {
          sale_id: saleId,
          user_id: session.user.id,
          amount: paymentAmount,
          method: "efectivo",
          notes: "Pago registrado desde la app",
        },
      ])
      .select()
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    const salePayments = await supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", saleId);

    if (!salePayments.error) {
      const totalPaid = (salePayments.data || []).reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

      const sale = sales.find((s) => s.id === saleId);
      if (sale) {
        const total = Number(sale.total || 0);
        const amountDue = Math.max(0, total - totalPaid);
        const status = amountDue === 0 ? "pagada" : totalPaid > 0 ? "abono" : "pendiente";

        await supabase
          .from("sales")
          .update({
            amount_paid: totalPaid,
            amount_due: amountDue,
            status,
          })
          .eq("id", saleId);
      }
    }

    await logAudit("payment", "payment", paymentData?.id, `Registró pago de $${paymentAmount}`);

    setPaymentForms((prev) => ({
      ...prev,
      [saleId]: "",
    }));

    loadPayments();
    loadSales();
  }

  async function handleUpdateProfileRole(profileId, newRole) {
    if (!canManageTeam) {
      setError("Solo admin puede cambiar roles");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit("role_change", "profile", profileId, `Cambió rol a ${newRole}`);
    loadProfiles();
  }

  async function handleToggleProfileActive(profile) {
    if (!canManageTeam) {
      setError("Solo admin puede activar o desactivar usuarios");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      setError(error.message);
      return;
    }

    await logAudit(
      "status_change",
      "profile",
      profile.id,
      `${!profile.is_active ? "Activó" : "Desactivó"} usuario ${profile.full_name || profile.email || profile.id}`
    );

    loadProfiles();
  }

  function handleDownloadQuotePdf(quote) {
    const doc = new jsPDF();

    const customerName = quote.customers?.full_name || "Sin cliente";
    const quoteDate = new Date(quote.created_at).toLocaleDateString();
    const items = quote.quote_items || [];
    const subtotal = Number(quote.subtotal || 0);
    const discount = Number(quote.discount || 0);
    const subtotalAfterDiscount = subtotal - discount;
    const total = Number(quote.total || 0);
    const ivaAmount = total - subtotalAfterDiscount;

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 210, 38, "F");
    doc.setFillColor(250, 204, 21);
    doc.rect(0, 38, 210, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(business.name || "EIKO PRINT", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Cotización profesional", 14, 27);

    doc.setTextColor(250, 204, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(business.name || "EIKO PRINT", 14, 52);

    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`RUC: ${business.ruc || "-"}`, 14, 59);
    doc.text(`Tel: ${business.phone || "-"}`, 14, 65);
    doc.text(`${business.address || "-"}`, 14, 71);

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("COTIZACIÓN", 140, 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Número: ${quote.quote_number}`, 140, 60);
    doc.text(`Fecha: ${quoteDate}`, 140, 66);
    doc.text(`Cliente: ${customerName}`, 140, 72);

    doc.setFillColor(230, 230, 230);
    doc.rect(14, 82, 182, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Descripción", 16, 89);
    doc.text("Cant.", 120, 89);
    doc.text("P. Unit", 145, 89);
    doc.text("Subtotal", 173, 89, { align: "right" });

    let y = 98;

    doc.setFont("helvetica", "normal");

    items.forEach((item) => {
      const descLines = doc.splitTextToSize(item.description || "-", 95);
      const rowHeight = Math.max(8, descLines.length * 5);

      doc.text(descLines, 16, y);
      doc.text(String(item.quantity || 0), 122, y);
      doc.text(`$${Number(item.unit_price || 0).toFixed(2)}`, 145, y);
      doc.text(`$${Number(item.subtotal || 0).toFixed(2)}`, 173, y, {
        align: "right",
      });

      y += rowHeight;
    });

    y += 10;
    doc.line(120, y, 196, y);
    y += 8;
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 150, y, { align: "right" });
    y += 8;
    doc.text(`Descuento: -$${discount.toFixed(2)}`, 150, y, { align: "right" });
    y += 8;
    doc.text(`Subtotal final: $${subtotalAfterDiscount.toFixed(2)}`, 150, y, {
      align: "right",
    });
    y += 8;
    doc.text(`IVA: $${ivaAmount.toFixed(2)}`, 150, y, { align: "right" });
    y += 10;

    doc.setFillColor(250, 204, 21);
    doc.roundedRect(122, y - 6, 74, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`TOTAL: $${total.toFixed(2)}`, 159, y + 3, { align: "center" });

    doc.save(`${quote.quote_number}.pdf`);
  }

  function handleDownloadFinancialReportPdf() {
    const doc = new jsPDF();
    const nowText = new Date().toLocaleString();

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 210, 38, "F");
    doc.setFillColor(250, 204, 21);
    doc.rect(0, 38, 210, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(business.name || "EIKO PRINT", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Reporte financiero", 14, 27);

    doc.setTextColor(250, 204, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(business.name || "EIKO PRINT", 14, 52);

    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`RUC: ${business.ruc || "-"}`, 14, 59);
    doc.text(`Tel: ${business.phone || "-"}`, 14, 65);
    doc.text(`${business.address || "-"}`, 14, 71);

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RESUMEN FINANCIERO", 14, 84);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generado: ${nowText}`, 14, 92);

    doc.text(`Total vendido: $${dashboardFinancial.totalSold.toFixed(2)}`, 14, 106);
    doc.text(`Costo exacto vendido: $${dashboardFinancial.exactCostOfSales.toFixed(2)}`, 14, 114);
    doc.text(`Compras del periodo: $${dashboardFinancial.totalPurchases.toFixed(2)}`, 14, 122);
    doc.text(`Gastos: $${dashboardFinancial.totalExpenseAmount.toFixed(2)}`, 14, 130);
    doc.text(`Cobrado: $${dashboardFinancial.totalPaid.toFixed(2)}`, 14, 138);
    doc.text(`Pendiente: $${dashboardFinancial.totalDue.toFixed(2)}`, 14, 146);

    doc.setFillColor(250, 204, 21);
    doc.roundedRect(14, 156, 182, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      `UTILIDAD EXACTA: $${dashboardFinancial.exactProfit.toFixed(2)}`,
      105,
      168,
      { align: "center" }
    );

    doc.save("reporte-financiero.pdf");
  }

  const dashboardCard = {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  const brandHeaderStyle = {
    marginBottom: 24,
    padding: "22px 24px",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.82) 100%)",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 14px 34px rgba(15,23,42,0.10)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  };

  if (!session) {
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: "50px auto", fontFamily: "Arial" }}>
        <h1>{business.name || "EIKO PRINT"} Login</h1>

        {error && <p style={{ color: "red" }}>Error: {error}</p>}

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 10 }}>
          <input
            type="email"
            placeholder="Correo"
            value={loginForm.email}
            onChange={(e) =>
              setLoginForm({ ...loginForm, email: e.target.value })
            }
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm({ ...loginForm, password: e.target.value })
            }
            required
          />
          <button type="submit">Iniciar sesión</button>
        </form>
      </div>
    );
  }

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout}>
      <div style={brandHeaderStyle}>
        <div>
          <div
            style={{
              display: "inline-block",
              marginBottom: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(250, 204, 21, 0.16)",
              color: "#a16207",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Premium Print Studio
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 38,
              lineHeight: 1,
              letterSpacing: "0.06em",
              fontWeight: 900,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#111827" }}>
              {business.name ? business.name.split(" ")[0] : "EIKO"}
            </span>
            <span
              style={{
                background: "linear-gradient(135deg, #facc15 0%, #fde047 45%, #eab308 100%)",
                color: "#111827",
                padding: "6px 14px",
                borderRadius: 14,
              }}
            >
              {business.name
                ? business.name.split(" ").slice(1).join(" ") || "PRINT"
                : "PRINT"}
            </span>
          </h1>

          <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 14 }}>
            Usuario: {session.user.email} | Rol: <strong>{role}</strong>
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button type="button" onClick={() => setCurrentPage("business")}>
            Configuración
          </button>
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            Sistema Pro
          </div>
        </div>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {currentPage === "business" && (
        <div style={{ maxWidth: 700 }}>
          <div style={dashboardCard}>
            <h2>Configuración del negocio</h2>

            <form onSubmit={handleSaveBusiness} style={{ display: "grid", gap: 10 }}>
              <input
                placeholder="Nombre del negocio"
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              />

              <input
                placeholder="Teléfono"
                value={business.phone}
                onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
              />

              <input
                placeholder="Correo"
                value={business.email}
                onChange={(e) => setBusiness({ ...business, email: e.target.value })}
              />

              <input
                placeholder="Dirección"
                value={business.address}
                onChange={(e) => setBusiness({ ...business, address: e.target.value })}
              />

              <input
                placeholder="RUC"
                value={business.ruc}
                onChange={(e) => setBusiness({ ...business, ruc: e.target.value })}
              />

              <input
                type="number"
                placeholder="% IVA"
                value={business.iva_percent}
                onChange={(e) =>
                  setBusiness({ ...business, iva_percent: Number(e.target.value || 0) })
                }
              />

              <input
                placeholder="URL del logo (opcional)"
                value={business.logo_url}
                onChange={(e) => setBusiness({ ...business, logo_url: e.target.value })}
              />

              <button type="submit">Guardar configuración</button>
            </form>
          </div>
        </div>
      )}

      {(currentPage === "dashboard" ||
        currentPage === "quotes" ||
        currentPage === "sales" ||
        currentPage === "expenses") && (
        <div style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setDateFilter("all")}>Todo</button>
          <button onClick={() => setDateFilter("day")}>Hoy</button>
          <button onClick={() => setDateFilter("week")}>7 días</button>
          <button onClick={() => setDateFilter("month")}>Este mes</button>
          {currentPage === "dashboard" && (
            <>
              <button onClick={handleDownloadFinancialReportPdf}>📄 Reporte PDF</button>
              <button onClick={downloadBackup}>🔒 Descargar respaldo</button>
            </>
          )}
        </div>
      )}

      {currentPage === "dashboard" && (
        <>
          <h2>Dashboard</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 15,
              marginBottom: 20,
            }}
          >
            <div style={dashboardCard}><strong>Ventas</strong><p style={{ fontSize: 24 }}>{filteredSales.length}</p></div>
            <div style={dashboardCard}><strong>Compras</strong><p style={{ fontSize: 24 }}>{filteredPurchasesByDate.length}</p></div>
            <div style={dashboardCard}><strong>Por cobrar</strong><p style={{ fontSize: 24 }}>{receivables.length}</p></div>
            <div style={dashboardCard}><strong>Total vendido</strong><p style={{ fontSize: 24 }}>${dashboardFinancial.totalSold.toFixed(2)}</p></div>
            <div style={dashboardCard}><strong>Costo exacto</strong><p style={{ fontSize: 24 }}>${dashboardFinancial.exactCostOfSales.toFixed(2)}</p></div>
            <div style={dashboardCard}><strong>Compras periodo</strong><p style={{ fontSize: 24 }}>${dashboardFinancial.totalPurchases.toFixed(2)}</p></div>
            <div style={dashboardCard}><strong>Gastos</strong><p style={{ fontSize: 24 }}>${dashboardFinancial.totalExpenseAmount.toFixed(2)}</p></div>
            <div style={dashboardCard}><strong>Utilidad exacta</strong><p style={{ fontSize: 24, color: "#16a34a" }}>${dashboardFinancial.exactProfit.toFixed(2)}</p></div>
            <div style={dashboardCard}><strong>Pendiente</strong><p style={{ fontSize: 24, color: "crimson" }}>${dashboardFinancial.totalDue.toFixed(2)}</p></div>
          </div>

          <div style={{ ...dashboardCard, marginBottom: 20 }}>
            <h2>📊 Gráfico financiero</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ventas" />
                <Bar dataKey="gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...dashboardCard, marginBottom: 20 }}>
            <h2>🏆 Ganancia por producto</h2>

            {profitByProduct.length === 0 ? (
              <p>No hay ventas facturadas para calcular ganancia.</p>
            ) : (
              <ul>
                {profitByProduct.map((item, index) => (
                  <li key={`${item.name}-${index}`} style={{ marginBottom: 12 }}>
                    <strong>{item.name}</strong><br />
                    Cantidad vendida: {item.quantity}<br />
                    Ingreso: ${item.revenue.toFixed(2)}<br />
                    Costo exacto: ${item.cost.toFixed(2)}<br />
                    Ganancia: <strong>${item.profit.toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={dashboardCard}>
            <strong>Stock bajo</strong>
            {lowStockProducts.length === 0 ? (
              <p style={{ marginTop: 10 }}>No hay productos con stock bajo.</p>
            ) : (
              <ul style={{ marginTop: 10 }}>
                {lowStockProducts.map((product) => (
                  <li key={product.id}>
                    {product.name} — stock: {product.stock} / mínimo: {product.min_stock}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {currentPage === "products" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div>
            <div style={{ ...dashboardCard, marginBottom: 20 }}>
              <h2>{editingProductId ? "Editar producto" : "Registrar producto"}</h2>
              <form onSubmit={handleCreateProduct} style={{ display: "grid", gap: 10 }}>
                <input placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
                <input placeholder="Categoría" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} />
                <input placeholder="Unidad" value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} />
                <input type="number" placeholder="Stock" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} />
                <input type="number" placeholder="Stock mínimo" value={productForm.min_stock} onChange={(e) => setProductForm({ ...productForm, min_stock: e.target.value })} />
                <input type="number" step="0.01" placeholder="Costo" value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} />
                <input type="number" step="0.01" placeholder="Precio" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                <button type="submit">{editingProductId ? "Actualizar producto" : "Guardar producto"}</button>
              </form>
            </div>

            <div style={{ ...dashboardCard, marginBottom: 20 }}>
              <h2>Proveedores</h2>
              <form onSubmit={handleCreateSupplier} style={{ display: "grid", gap: 10 }}>
                <input placeholder="Nombre proveedor" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required />
                <input placeholder="Teléfono" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                <input placeholder="Correo" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                <textarea placeholder="Notas" value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
                <button type="submit">Guardar proveedor</button>
              </form>
            </div>

            <div style={{ ...dashboardCard, marginBottom: 20 }}>
              <h2>Registrar compra</h2>
              <form onSubmit={handleCreatePurchase} style={{ display: "grid", gap: 10 }}>
                <select
                  value={purchaseForm.product_id}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, product_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                <select
                  value={purchaseForm.supplier_id}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                >
                  <option value="">Proveedor opcional</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Cantidad comprada"
                  value={purchaseForm.quantity}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                  required
                />

                <input
                  type="number"
                  step="0.01"
                  placeholder="Costo unitario"
                  value={purchaseForm.unit_cost}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })}
                  required
                />

                <textarea
                  placeholder="Notas"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                />

                <button type="submit">Guardar compra</button>
              </form>
            </div>

            <div style={dashboardCard}>
              <h2>Movimiento de inventario</h2>
              <form onSubmit={handleInventoryMovement} style={{ display: "grid", gap: 10 }}>
                <select value={movementForm.product_id} onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })} required>
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                <select value={movementForm.movement_type} onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}>
                  <option value="entrada">➕ Entrada</option>
                  <option value="salida">➖ Salida</option>
                  <option value="ajuste">🛠 Ajuste</option>
                </select>

                <input
                  type="number"
                  placeholder={movementForm.movement_type === "ajuste" ? "Nuevo stock real" : "Cantidad"}
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                  required
                />

                <textarea placeholder="Motivo / observación" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />

                <button type="submit">Guardar movimiento</button>
              </form>
            </div>
          </div>

          <div>
            <div style={{ ...dashboardCard, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2>Inventario</h2>
                <button onClick={exportProductsCSV}>Exportar productos</button>
              </div>

              <input
                type="text"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: "100%", margin: "10px 0", padding: 8 }}
              />

              {filteredProducts.length === 0 ? (
                <p>No hay productos.</p>
              ) : (
                <ul>
                  {filteredProducts.map((product) => (
                    <li key={product.id} style={{ marginBottom: 14 }}>
                      <strong>{product.name}</strong><br />
                      Categoría: {product.category || "-"}<br />
                      Stock: {product.stock}<br />
                      Mínimo: {product.min_stock}<br />
                      Costo compra: ${Number(product.cost || 0).toFixed(2)}<br />
                      Precio venta: ${Number(product.price || 0).toFixed(2)}<br />
                      Utilidad unitaria: <strong>${(Number(product.price || 0) - Number(product.cost || 0)).toFixed(2)}</strong><br />

                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canEdit && <button onClick={() => handleEditProduct(product)}>✏️ Editar</button>}
                        {canDelete && (
                          <button onClick={() => handleDeleteProduct(product.id, product.name)} style={{ background: "red", color: "white" }}>
                            🗑 Eliminar
                          </button>
                        )}
                        <button onClick={() => quickInventoryMovement(product.id, "entrada")}>➕ Agregar inventario</button>
                        <button onClick={() => quickInventoryMovement(product.id, "salida")}>➖ Descontar inventario</button>
                        <button onClick={() => quickInventoryMovement(product.id, "ajuste")}>🛠 Ajustar stock</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ ...dashboardCard, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <h2>Compras recientes</h2>
                <button onClick={exportPurchasesCSV}>Exportar compras</button>
              </div>
              {purchases.length === 0 ? (
                <p>No hay compras registradas.</p>
              ) : (
                <ul>
                  {purchases.map((purchase) => (
                    <li key={purchase.id} style={{ marginBottom: 12 }}>
                      <strong>{purchase.products?.name || "Producto"}</strong><br />
                      Proveedor: {purchase.suppliers?.name || purchase.supplier_name || "-"}<br />
                      Cantidad: {purchase.quantity}<br />
                      Costo unitario: ${Number(purchase.unit_cost || 0).toFixed(2)}<br />
                      Total compra: ${Number(purchase.total_cost || 0).toFixed(2)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={dashboardCard}>
              <h2>Movimientos recientes</h2>
              {inventoryMovements.length === 0 ? (
                <p>No hay movimientos.</p>
              ) : (
                <ul>
                  {inventoryMovements.map((movement) => (
                    <li key={movement.id} style={{ marginBottom: 12 }}>
                      <strong>{movement.products?.name || "Producto"}</strong><br />
                      Tipo: {movement.movement_type}<br />
                      Cantidad: {movement.quantity}<br />
                      Antes: {movement.previous_stock} → Después: {movement.new_stock}<br />
                      Nota: {movement.notes || "-"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {currentPage === "customers" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={dashboardCard}>
            <h2>{editingCustomerId ? "Editar cliente" : "Crear cliente"}</h2>
            <form onSubmit={handleCreateCustomer} style={{ display: "grid", gap: 10 }}>
              <input placeholder="Nombre completo" value={customerForm.full_name} onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })} required />
              <input placeholder="Teléfono" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              <input placeholder="Correo" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              <input placeholder="Dirección" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
              <textarea placeholder="Notas" value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
              <button type="submit">{editingCustomerId ? "Actualizar cliente" : "Guardar cliente"}</button>
            </form>
          </div>

          <div style={dashboardCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2>Clientes</h2>
              <button onClick={exportCustomersCSV}>Exportar clientes</button>
            </div>

            <input
              type="text"
              placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ width: "100%", margin: "10px 0", padding: 8 }}
            />

            {filteredCustomers.length === 0 ? (
              <p>No hay clientes.</p>
            ) : (
              <ul>
                {filteredCustomers.map((customer) => (
                  <li key={customer.id} style={{ marginBottom: 12 }}>
                    <strong>{customer.full_name}</strong><br />
                    Tel: {customer.phone || "-"}<br />
                    Email: {customer.email || "-"}<br />
                    <div style={{ marginTop: 6 }}>
                      {canEdit && <button onClick={() => handleEditCustomer(customer)} style={{ marginRight: 6 }}>✏️ Editar</button>}
                      {canDelete && (
                        <button onClick={() => handleDeleteCustomer(customer.id, customer.full_name)} style={{ background: "red", color: "white" }}>
                          🗑 Eliminar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {currentPage === "quotes" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={dashboardCard}>
            <h2>{editingQuoteId ? "Editar cotización" : "Crear cotización"}</h2>

            <form onSubmit={handleCreateQuote} style={{ display: "grid", gap: 10 }}>
              <select value={quoteForm.customer_id} onChange={(e) => setQuoteForm({ ...quoteForm, customer_id: e.target.value })} required>
                <option value="">Selecciona un cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.full_name}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={quoteForm.includeIva}
                    onChange={(e) =>
                      setQuoteForm({
                        ...quoteForm,
                        includeIva: e.target.checked,
                      })
                    }
                  />{" "}
                  Incluir IVA
                </label>

                <input
                  type="number"
                  placeholder="% IVA"
                  value={quoteForm.ivaRate}
                  onChange={(e) =>
                    setQuoteForm({
                      ...quoteForm,
                      ivaRate: Number(e.target.value || 0),
                    })
                  }
                  style={{ width: 100 }}
                />
              </div>

              <input
                type="number"
                placeholder="Descuento %"
                value={quoteForm.discountPercent}
                onChange={(e) =>
                  setQuoteForm({
                    ...quoteForm,
                    discountPercent: Number(e.target.value || 0),
                  })
                }
              />

              <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <strong>Ítems</strong>

                {quoteItems.map((item, index) => {
                  const lineSubtotal =
                    Number(item.quantity || 0) * Number(item.unit_price || 0);

                  return (
                    <div
                      key={index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1.8fr 0.8fr 0.9fr auto",
                        gap: 8,
                        marginTop: 10,
                        alignItems: "center",
                      }}
                    >
                      <select value={item.product_id} onChange={(e) => updateQuoteItem(index, "product_id", e.target.value)}>
                        <option value="">Producto opcional</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>

                      <input placeholder="Descripción" value={item.description} onChange={(e) => updateQuoteItem(index, "description", e.target.value)} />
                      <input type="number" placeholder="Cantidad" value={item.quantity} onChange={(e) => updateQuoteItem(index, "quantity", e.target.value)} />
                      <input type="number" step="0.01" placeholder="P. Unit" value={item.unit_price} onChange={(e) => updateQuoteItem(index, "unit_price", e.target.value)} />
                      <button type="button" onClick={() => removeQuoteItem(index)}>❌</button>

                      <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#444" }}>
                        Subtotal línea: ${lineSubtotal.toFixed(2)}
                      </div>
                    </div>
                  );
                })}

                <button type="button" onClick={addQuoteItem} style={{ marginTop: 10 }}>
                  + Agregar ítem
                </button>
              </div>

              <textarea placeholder="Notas generales" value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} />

              <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, background: "#fafafa" }}>
                <p style={{ margin: "4px 0" }}><strong>Subtotal:</strong> ${quoteSummary.subtotal.toFixed(2)}</p>
                <p style={{ margin: "4px 0" }}><strong>Descuento ({quoteSummary.discountPercent}%):</strong> -${quoteSummary.discountAmount.toFixed(2)}</p>
                <p style={{ margin: "4px 0" }}><strong>Subtotal final:</strong> ${quoteSummary.subtotalAfterDiscount.toFixed(2)}</p>
                <p style={{ margin: "4px 0" }}><strong>IVA:</strong> ${quoteSummary.ivaAmount.toFixed(2)}</p>
                <p style={{ margin: "4px 0", fontSize: 18 }}><strong>Total:</strong> ${quoteSummary.total.toFixed(2)}</p>
              </div>

              <button type="submit">{editingQuoteId ? "Actualizar cotización" : "Guardar cotización"}</button>
            </form>
          </div>

          <div style={dashboardCard}>
            <h2>Cotizaciones</h2>

            {filteredQuotesByDate.length === 0 ? (
              <p>No hay cotizaciones.</p>
            ) : (
              <ul>
                {filteredQuotesByDate.map((quote) => {
                  const whatsappLink = buildQuoteWhatsappLink(quote);

                  return (
                    <li key={quote.id} style={{ marginBottom: 16 }}>
                      <strong>{quote.quote_number}</strong><br />
                      Cliente: {quote.customers?.full_name || "Sin cliente"}<br />
                      Estado: {quote.status}<br />
                      Subtotal: ${Number(quote.subtotal || 0).toFixed(2)}<br />
                      Descuento: -${Number(quote.discount || 0).toFixed(2)}<br />
                      Total: ${Number(quote.total || 0).toFixed(2)}<br />

                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canEdit && <button onClick={() => handleEditQuote(quote)}>✏️ Editar</button>}
                        {canDelete && (
                          <button onClick={() => handleDeleteQuote(quote.id, quote.quote_number)} style={{ background: "red", color: "white" }}>
                            🗑 Eliminar
                          </button>
                        )}
                        <button onClick={() => handleDownloadQuotePdf(quote)}>📄 PDF</button>
                        {whatsappLink && (
                          <a href={whatsappLink} target="_blank" rel="noreferrer">
                            <button type="button">WhatsApp</button>
                          </a>
                        )}
                        {quote.status !== "facturada" && (
                          <button onClick={() => handleConvertQuoteToSale(quote)}>
                            Convertir a venta
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {currentPage === "sales" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={dashboardCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2>Ventas / Cuentas por cobrar</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={exportSalesCSV}>Exportar ventas</button>
                <button onClick={exportReceivablesCSV}>Exportar por cobrar</button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Buscar venta..."
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
              style={{ width: "100%", margin: "10px 0", padding: 8 }}
            />

            {receivables.length > 0 && (
              <div style={{ marginBottom: 20, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
                <strong>Clientes con saldo pendiente</strong>
                <ul>
                  {receivables.map((sale) => {
                    const whatsappLink = buildReceivableWhatsappLink(sale);

                    return (
                      <li key={`receivable-${sale.id}`} style={{ marginBottom: 10 }}>
                        {sale.customers?.full_name || "Sin cliente"} — {sale.sale_number} — pendiente: ${Number(sale.amount_due || 0).toFixed(2)}
                        {whatsappLink && (
                          <span style={{ marginLeft: 8 }}>
                            <a href={whatsappLink} target="_blank" rel="noreferrer">
                              <button type="button">Cobrar por WhatsApp</button>
                            </a>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {filteredSales.length === 0 ? (
              <p>No hay ventas.</p>
            ) : (
              <ul>
                {filteredSales.map((sale) => (
                  <li key={sale.id} style={{ marginBottom: 20 }}>
                    <strong>{sale.sale_number}</strong><br />
                    Cliente: {sale.customers?.full_name || "Sin cliente"}<br />
                    Estado: {sale.status}<br />
                    Total: ${Number(sale.total || 0).toFixed(2)}<br />
                    Pagado: ${Number(sale.amount_paid || 0).toFixed(2)}<br />
                    Pendiente: ${Number(sale.amount_due || 0).toFixed(2)}<br />

                    <div style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        placeholder="Monto a pagar"
                        value={paymentForms[sale.id] || ""}
                        onChange={(e) =>
                          setPaymentForms((prev) => ({
                            ...prev,
                            [sale.id]: e.target.value,
                          }))
                        }
                        style={{ marginRight: 8 }}
                      />
                      <button onClick={() => handleAddPayment(sale.id)}>
                        Registrar pago
                      </button>
                    </div>

                    <div style={{ marginTop: 10, paddingLeft: 8 }}>
                      <strong>Historial de pagos</strong>
                      {(paymentsBySaleId[sale.id] || []).length === 0 ? (
                        <p>No hay pagos registrados.</p>
                      ) : (
                        <ul>
                          {(paymentsBySaleId[sale.id] || []).map((payment) => (
                            <li key={payment.id}>
                              ${Number(payment.amount || 0).toFixed(2)} — {new Date(payment.created_at).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={dashboardCard}>
            <h2>Pagos recientes</h2>
            {payments.length === 0 ? (
              <p>No hay pagos registrados.</p>
            ) : (
              <ul>
                {payments.slice(0, 30).map((payment) => (
                  <li key={payment.id} style={{ marginBottom: 12 }}>
                    <strong>{payment.sales?.sale_number || "Venta"}</strong><br />
                    Cliente: {payment.sales?.customers?.full_name || "-"}<br />
                    Pago: ${Number(payment.amount || 0).toFixed(2)}<br />
                    Fecha: {new Date(payment.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {currentPage === "expenses" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={dashboardCard}>
            <h2>{editingExpenseId ? "Editar gasto" : "Registrar gasto"}</h2>

            <form onSubmit={handleCreateExpense} style={{ display: "grid", gap: 10 }}>
              <input placeholder="Concepto" value={expenseForm.concept} onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })} required />
              <input placeholder="Categoría" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              <input type="number" placeholder="Monto" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
              <textarea placeholder="Notas" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
              <button type="submit">{editingExpenseId ? "Actualizar gasto" : "Guardar gasto"}</button>
            </form>
          </div>

          <div style={dashboardCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2>Gastos</h2>
              <button onClick={exportExpensesCSV}>Exportar gastos</button>
            </div>
            {filteredExpensesByDate.length === 0 ? (
              <p>No hay gastos.</p>
            ) : (
              <ul>
                {filteredExpensesByDate.map((expense) => (
                  <li key={expense.id} style={{ marginBottom: 14 }}>
                    <strong>{expense.concept}</strong><br />
                    Categoría: {expense.category || "-"}<br />
                    Monto: ${expense.amount}<br />
                    Notas: {expense.notes || "-"}<br />
                    <div style={{ marginTop: 6 }}>
                      {canEdit && (
                        <button onClick={() => handleEditExpense(expense)} style={{ marginRight: 6 }}>
                          ✏️ Editar
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeleteExpense(expense.id, expense.concept)} style={{ background: "red", color: "white" }}>
                          🗑 Eliminar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {currentPage === "team" && (
        <div style={dashboardCard}>
          <h2>Equipo</h2>

          {!canManageTeam ? (
            <p>Solo admin puede gestionar roles y usuarios.</p>
          ) : (
            <>
              <p style={{ marginBottom: 16 }}>
                Crea las cuentas nuevas en Supabase Auth y aquí les cambias el rol.
              </p>

              {profiles.length === 0 ? (
                <p>No hay perfiles.</p>
              ) : (
                <ul>
                  {profiles.map((profile) => (
                    <li key={profile.id} style={{ marginBottom: 16 }}>
                      <strong>{profile.full_name || profile.email || profile.id}</strong><br />
                      Email: {profile.email || "-"}<br />
                      Estado: {profile.is_active ? "Activo" : "Inactivo"}<br />

                      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                          value={profile.role || "employee"}
                          onChange={(e) => handleUpdateProfileRole(profile.id, e.target.value)}
                        >
                          <option value="admin">admin</option>
                          <option value="secretary">secretary</option>
                          <option value="employee">employee</option>
                        </select>

                        <button onClick={() => handleToggleProfileActive(profile)}>
                          {profile.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {currentPage === "audit" && (
        <div style={dashboardCard}>
          <h2>Auditoría</h2>

          {!canViewAudit ? (
            <p>Solo admin puede ver la auditoría.</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Buscar en auditoría..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                style={{ width: "100%", margin: "10px 0", padding: 8 }}
              />

              {filteredAuditLogs.length === 0 ? (
                <p>No hay registros todavía.</p>
              ) : (
                <ul>
                  {filteredAuditLogs.map((log) => (
                    <li key={log.id} style={{ marginBottom: 14 }}>
                      <strong style={{ color: "#2563eb" }}>{log.actor_name || "Usuario"}</strong><br />
                      Acción: {log.action_type}<br />
                      Módulo: {log.entity_type}<br />
                      Descripción: {log.description}<br />
                      <span style={{ fontSize: 12, color: "#666" }}>ID: {log.entity_id || "-"}</span><br />
                      Fecha: {new Date(log.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Layout>
  );
}