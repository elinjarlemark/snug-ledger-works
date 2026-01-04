import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Customer, Product, Invoice, InvoiceLine, calculateInvoiceLine } from "@/lib/billing/types";
import { useAuth } from "./AuthContext";

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

export function BillingProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1);

  const companyId = activeCompany?.id || "";

  // Load data when company changes
  useEffect(() => {
    if (!companyId) {
      setCustomers([]);
      setProducts([]);
      setInvoices([]);
      setNextInvoiceNumber(1);
      return;
    }

    const storedCustomers = localStorage.getItem(`billing_customers_${companyId}`);
    const storedProducts = localStorage.getItem(`billing_products_${companyId}`);
    const storedInvoices = localStorage.getItem(`billing_invoices_${companyId}`);
    const storedNextNumber = localStorage.getItem(`billing_next_invoice_${companyId}`);

    if (storedCustomers) setCustomers(JSON.parse(storedCustomers));
    else setCustomers([]);

    if (storedProducts) setProducts(JSON.parse(storedProducts));
    else setProducts([]);

    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    else setInvoices([]);

    if (storedNextNumber) setNextInvoiceNumber(parseInt(storedNextNumber));
    else setNextInvoiceNumber(1);
  }, [companyId]);

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
    saveCustomers([...customers, newCustomer]);
    return newCustomer;
  };

  const updateCustomer = (customer: Customer) => {
    saveCustomers(customers.map(c => c.id === customer.id ? customer : c));
  };

  const deleteCustomer = (customerId: string) => {
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
    saveProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = (product: Product) => {
    saveProducts(products.map(p => p.id === product.id ? product : p));
  };

  const deleteProduct = (productId: string) => {
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
