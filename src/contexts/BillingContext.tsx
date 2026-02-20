import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Customer, Product, Invoice } from "@/lib/billing/types";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/auth";

interface BillingContextType {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  nextInvoiceNumber: number;
  addCustomer: (customer: Omit<Customer, "id" | "companyId" | "createdAt">) => Customer;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  getCustomerById: (customerId: string) => Customer | undefined;
  addProduct: (product: Omit<Product, "id" | "companyId" | "createdAt">) => Product;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  getProductById: (productId: string) => Product | undefined;
  createInvoice: (invoice: Omit<Invoice, "id" | "companyId" | "invoiceNumber" | "createdAt">) => Invoice;
  updateInvoiceStatus: (invoiceId: string, status: Invoice["status"], paidDate?: string) => void;
  deleteInvoice: (invoiceId: string) => void;
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const mapCustomerFromApi = (customer: any): Customer => ({
  id: String(customer.id),
  companyId: String(customer.company_id ?? ""),
  type: customer.type,
  name: customer.name,
  organizationNumber: customer.organization_number ?? undefined,
  email: customer.email ?? undefined,
  phone: customer.phone ?? undefined,
  address: customer.address,
  postalCode: customer.postal_code,
  city: customer.city,
  country: customer.country,
  createdAt: customer.created_at ?? new Date().toISOString(),
});

const mapProductFromApi = (product: any): Product => ({
  id: String(product.id),
  companyId: String(product.company_id ?? ""),
  name: product.name,
  description: product.description ?? undefined,
  price: Number(product.price ?? 0),
  includesVat: Boolean(product.includes_vat),
  vatRate: Number(product.vat_rate ?? 25),
  unit: product.unit ?? undefined,
  createdAt: product.created_at ?? new Date().toISOString(),
});

export function BillingProvider({ children }: { children: ReactNode }) {
  const { activeCompany, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1);

  const companyId = activeCompany?.id || "";
  const parsedCompanyId = Number(companyId);
  const hasNumericCompanyId = Number.isFinite(parsedCompanyId);

  useEffect(() => {
    let isCurrentEffect = true;

    if (!companyId) {
      setCustomers([]);
      setProducts([]);
      setInvoices([]);
      setNextInvoiceNumber(1);
      return;
    }

    const storedInvoices = localStorage.getItem(`billing_invoices_${companyId}`);
    const storedNextNumber = localStorage.getItem(`billing_next_invoice_${companyId}`);

    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    else setInvoices([]);

    if (storedNextNumber) setNextInvoiceNumber(parseInt(storedNextNumber));
    else setNextInvoiceNumber(1);

    if (authService.isDatabaseConnected() && user && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/customers?user_id=${user.id}&company_id=${parsedCompanyId}`)
        .then((response) => response.json())
        .then((payload) => {
          if (!isCurrentEffect) {
            return;
          }
          const apiCustomers = Array.isArray(payload) ? payload.map(mapCustomerFromApi) : [];
          setCustomers(apiCustomers);
        })
        .catch(() => {
          if (isCurrentEffect) {
            setCustomers([]);
          }
        });

      fetch(`${API_BASE_URL}/products?user_id=${user.id}&company_id=${parsedCompanyId}`)
        .then((response) => response.json())
        .then((payload) => {
          if (!isCurrentEffect) {
            return;
          }
          const apiProducts = Array.isArray(payload) ? payload.map(mapProductFromApi) : [];
          setProducts(apiProducts);
        })
        .catch(() => {
          if (isCurrentEffect) {
            setProducts([]);
          }
        });

      return () => {
        isCurrentEffect = false;
      };

    }

    const storedCustomers = localStorage.getItem(`billing_customers_${companyId}`);
    const storedProducts = localStorage.getItem(`billing_products_${companyId}`);

    if (storedCustomers) setCustomers(JSON.parse(storedCustomers));
    else setCustomers([]);

    if (storedProducts) setProducts(JSON.parse(storedProducts));
    else setProducts([]);

    return () => {
      isCurrentEffect = false;
    };
  }, [companyId, user]);

  const saveCustomers = (newCustomers: Customer[]) => {
    setCustomers(newCustomers);
    if (companyId) {
      localStorage.setItem(`billing_customers_${companyId}`, JSON.stringify(newCustomers));
    }
  };

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    if (companyId) {
      localStorage.setItem(`billing_products_${companyId}`, JSON.stringify(newProducts));
    }
  };

  const saveInvoices = (newInvoices: Invoice[], newNextNumber: number) => {
    setInvoices(newInvoices);
    setNextInvoiceNumber(newNextNumber);
    if (companyId) {
      localStorage.setItem(`billing_invoices_${companyId}`, JSON.stringify(newInvoices));
      localStorage.setItem(`billing_next_invoice_${companyId}`, newNextNumber.toString());
    }
  };

  const addCustomer = (customerData: Omit<Customer, "id" | "companyId" | "createdAt">) => {
    const newCustomer: Customer = {
      ...customerData,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
    };

    if (authService.isDatabaseConnected() && user && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          company_id: parsedCompanyId,
          type: newCustomer.type,
          name: newCustomer.name,
          organization_number: newCustomer.organizationNumber,
          email: newCustomer.email,
          phone: newCustomer.phone,
          address: newCustomer.address,
          postal_code: newCustomer.postalCode,
          city: newCustomer.city,
          country: newCustomer.country,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const createdCustomer = { ...newCustomer, id: String(payload.id ?? newCustomer.id) };
        setCustomers((prev) => [...prev, createdCustomer]);
      });
      return newCustomer;
    }

    saveCustomers([...customers, newCustomer]);
    return newCustomer;
  };

  const updateCustomer = (customer: Customer) => {
    if (authService.isDatabaseConnected() && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: customer.type,
          name: customer.name,
          organization_number: customer.organizationNumber,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          postal_code: customer.postalCode,
          city: customer.city,
          country: customer.country,
        }),
      }).then(() => {
        setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
      });
      return;
    }

    saveCustomers(customers.map(c => c.id === customer.id ? customer : c));
  };

  const deleteCustomer = (customerId: string) => {
    if (authService.isDatabaseConnected() && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/customers/${customerId}`, { method: "DELETE" }).then(() => {
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      });
      return;
    }

    saveCustomers(customers.filter(c => c.id !== customerId));
  };

  const getCustomerById = (customerId: string) => customers.find(c => c.id === customerId);

  const addProduct = (productData: Omit<Product, "id" | "companyId" | "createdAt">) => {
    const newProduct: Product = {
      ...productData,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
    };

    if (authService.isDatabaseConnected() && user && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          company_id: parsedCompanyId,
          name: newProduct.name,
          description: newProduct.description,
          price: newProduct.price,
          includes_vat: newProduct.includesVat,
          vat_rate: newProduct.vatRate,
          unit: newProduct.unit,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const createdProduct = { ...newProduct, id: String(payload.id ?? newProduct.id) };
        setProducts((prev) => [...prev, createdProduct]);
      });
      return newProduct;
    }

    saveProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = (product: Product) => {
    if (authService.isDatabaseConnected() && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          price: product.price,
          includes_vat: product.includesVat,
          vat_rate: product.vatRate,
          unit: product.unit,
        }),
      }).then(() => {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
      });
      return;
    }

    saveProducts(products.map(p => p.id === product.id ? product : p));
  };

  const deleteProduct = (productId: string) => {
    if (authService.isDatabaseConnected() && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/products/${productId}`, { method: "DELETE" }).then(() => {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      });
      return;
    }

    saveProducts(products.filter(p => p.id !== productId));
  };

  const getProductById = (productId: string) => products.find(p => p.id === productId);

  const createInvoice = (invoiceData: Omit<Invoice, "id" | "companyId" | "invoiceNumber" | "createdAt">) => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: crypto.randomUUID(),
      companyId,
      invoiceNumber: nextInvoiceNumber,
      createdAt: new Date().toISOString(),
    };
    saveInvoices([...invoices, newInvoice], nextInvoiceNumber + 1);
    return newInvoice;
  };

  const updateInvoiceStatus = (invoiceId: string, status: Invoice["status"], paidDate?: string) => {
    const newInvoices = invoices.map(inv => 
      inv.id === invoiceId ? { ...inv, status, paidDate } : inv
    );
    saveInvoices(newInvoices, nextInvoiceNumber);
  };

  const deleteInvoice = (invoiceId: string) => {
    saveInvoices(invoices.filter(inv => inv.id !== invoiceId), nextInvoiceNumber);
  };

  const getInvoiceById = (invoiceId: string) => invoices.find(inv => inv.id === invoiceId);

  return (
    <BillingContext.Provider value={{
      customers,
      products,
      invoices,
      nextInvoiceNumber,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      getCustomerById,
      addProduct,
      updateProduct,
      deleteProduct,
      getProductById,
      createInvoice,
      updateInvoiceStatus,
      deleteInvoice,
      getInvoiceById,
    }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error("useBilling must be used within a BillingProvider");
  }
  return context;
}
