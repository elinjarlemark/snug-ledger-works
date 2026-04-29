import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Customer, Product, Invoice, VoucherTemplate } from "@/lib/billing/types";
import { useAuth } from "./AuthContext";
import { authService } from "@/services/auth";
import { shouldUseLocalStorageMode } from "@/lib/runtimeMode";

interface BillingContextType {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  templates: VoucherTemplate[];
  nextInvoiceNumber: number;
  /** True once the user has explicitly chosen a starting invoice number (or created their first invoice). */
  firstInvoiceNumberSet: boolean;
  /** Manually set the next invoice number. Returns false if attempt was lower than current (rejected). */
  setNextInvoiceNumber: (n: number, opts?: { allowLower?: boolean; markFirstSet?: boolean }) => boolean;
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
  convertQuoteToInvoice: (quoteId: string) => Invoice | null;
  deleteInvoice: (invoiceId: string) => void;
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
  addTemplate: (template: Omit<VoucherTemplate, "id" | "companyId" | "createdAt">) => VoucherTemplate;
  updateTemplate: (template: VoucherTemplate) => void;
  deleteTemplate: (templateId: string) => void;
  setDefaultTemplate: (templateId: string) => void;
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
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumberState] = useState(1);
  const [firstInvoiceNumberSet, setFirstInvoiceNumberSet] = useState(false);

  const companyId = activeCompany?.id || "";
  const parsedCompanyId = Number(companyId);
  const hasNumericCompanyId = Number.isFinite(parsedCompanyId);
  const useLocalStorageMode = shouldUseLocalStorageMode();
  const shouldUseDatabase = authService.isDatabaseConnected() && !useLocalStorageMode;

  useEffect(() => {
    let isCurrentEffect = true;

    if (!companyId) {
      setCustomers([]);
      setProducts([]);
      setInvoices([]);
      setTemplates([]);
      setNextInvoiceNumber(1);
      return;
    }

    const storedInvoices = localStorage.getItem(`billing_invoices_${companyId}`);
    const storedNextNumber = localStorage.getItem(`billing_next_invoice_${companyId}`);
    const storedTemplates = localStorage.getItem(`billing_templates_${companyId}`);

    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    else setInvoices([]);

    if (storedTemplates) setTemplates(JSON.parse(storedTemplates));
    else setTemplates([]);

    if (storedNextNumber) setNextInvoiceNumber(parseInt(storedNextNumber));
    else setNextInvoiceNumber(1);

    if (shouldUseDatabase && user && hasNumericCompanyId) {
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
  }, [companyId, user, hasNumericCompanyId, parsedCompanyId, shouldUseDatabase]);

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

    if (shouldUseDatabase && user && hasNumericCompanyId) {
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
    if (shouldUseDatabase && hasNumericCompanyId) {
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
      }).then((response) => {
        if (!response.ok) {
          return;
        }
        setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
      });
      return;
    }

    saveCustomers(customers.map(c => c.id === customer.id ? customer : c));
  };

  const deleteCustomer = (customerId: string) => {
    if (shouldUseDatabase && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/customers/${customerId}`, { method: "DELETE" }).then((response) => {
        if (!response.ok) {
          return;
        }
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

    if (shouldUseDatabase && user && hasNumericCompanyId) {
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
    if (shouldUseDatabase && hasNumericCompanyId) {
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
      }).then((response) => {
        if (!response.ok) {
          return;
        }
        setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
      });
      return;
    }

    saveProducts(products.map(p => p.id === product.id ? product : p));
  };

  const deleteProduct = (productId: string) => {
    if (shouldUseDatabase && hasNumericCompanyId) {
      fetch(`${API_BASE_URL}/products/${productId}`, { method: "DELETE" }).then((response) => {
        if (!response.ok) {
          return;
        }
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
      documentType: invoiceData.documentType || "invoice",
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

  const convertQuoteToInvoice = (quoteId: string): Invoice | null => {
    const quote = invoices.find(inv => inv.id === quoteId);
    if (!quote) return null;
    const newInvoice: Invoice = {
      ...quote,
      id: crypto.randomUUID(),
      documentType: "invoice",
      invoiceNumber: nextInvoiceNumber,
      status: "sent",
      issueDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    const newInvoices = [
      ...invoices.map(inv => inv.id === quoteId ? { ...inv, status: "accepted" as const } : inv),
      newInvoice,
    ];
    saveInvoices(newInvoices, nextInvoiceNumber + 1);
    return newInvoice;
  };

  const deleteInvoice = (invoiceId: string) => {
    saveInvoices(invoices.filter(inv => inv.id !== invoiceId), nextInvoiceNumber);
  };

  const getInvoiceById = (invoiceId: string) => invoices.find(inv => inv.id === invoiceId);

  const saveTemplates = (newTemplates: VoucherTemplate[]) => {
    setTemplates(newTemplates);
    if (companyId) {
      localStorage.setItem(`billing_templates_${companyId}`, JSON.stringify(newTemplates));
    }
  };

  const addTemplate = (data: Omit<VoucherTemplate, "id" | "companyId" | "createdAt">) => {
    const newTemplate: VoucherTemplate = {
      ...data,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
    };
    let next = [...templates, newTemplate];
    if (newTemplate.isDefault) {
      next = next.map(t => t.id === newTemplate.id ? t : { ...t, isDefault: false });
    } else if (templates.length === 0) {
      // First template becomes default automatically
      next = next.map(t => t.id === newTemplate.id ? { ...t, isDefault: true } : t);
    }
    saveTemplates(next);
    return newTemplate;
  };

  const updateTemplate = (template: VoucherTemplate) => {
    let next = templates.map(t => t.id === template.id ? template : t);
    if (template.isDefault) {
      next = next.map(t => t.id === template.id ? t : { ...t, isDefault: false });
    }
    saveTemplates(next);
  };

  const deleteTemplate = (templateId: string) => {
    const next = templates.filter(t => t.id !== templateId);
    // If we removed the default, promote the first remaining
    if (next.length > 0 && !next.some(t => t.isDefault)) {
      next[0] = { ...next[0], isDefault: true };
    }
    saveTemplates(next);
  };

  const setDefaultTemplate = (templateId: string) => {
    const next = templates.map(t => ({ ...t, isDefault: t.id === templateId }));
    saveTemplates(next);
  };

  return (
    <BillingContext.Provider value={{
      customers,
      products,
      invoices,
      templates,
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
      convertQuoteToInvoice,
      deleteInvoice,
      getInvoiceById,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      setDefaultTemplate,
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
