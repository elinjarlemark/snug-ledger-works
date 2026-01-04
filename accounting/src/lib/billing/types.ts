export interface Customer {
  id: string;
  companyId: string;
  type: "private" | "company";
  name: string;
  organizationNumber?: string; // Only for companies
  email?: string;
  phone?: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  createdAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  price: number;
  includesVat: boolean;
  vatRate: number; // e.g., 25, 12, 6, or 0
  unit?: string; // e.g., "st", "tim", "kg"
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalExclVat: number;
  vatAmount: number;
  totalInclVat: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: number;
  customerId: string;
  customerName: string;
  customerAddress: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  subtotal: number;
  totalVat: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  paidDate?: string;
  createdAt: string;
}

export function calculateProductPrice(price: number, includesVat: boolean, vatRate: number) {
  if (includesVat) {
    const priceExclVat = price / (1 + vatRate / 100);
    const vatAmount = price - priceExclVat;
    return { priceExclVat, vatAmount, priceInclVat: price };
  } else {
    const vatAmount = price * (vatRate / 100);
    const priceInclVat = price + vatAmount;
    return { priceExclVat: price, vatAmount, priceInclVat };
  }
}

export function calculateInvoiceLine(
  quantity: number,
  unitPrice: number,
  vatRate: number
): { totalExclVat: number; vatAmount: number; totalInclVat: number } {
  const totalExclVat = quantity * unitPrice;
  const vatAmount = totalExclVat * (vatRate / 100);
  const totalInclVat = totalExclVat + vatAmount;
  return { totalExclVat, vatAmount, totalInclVat };
}
