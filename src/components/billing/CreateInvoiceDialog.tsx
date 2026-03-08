import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, UserPlus, Package, X, CalendarIcon } from "lucide-react";
import { Customer, Product, InvoiceLine, Invoice, DocumentType, calculateInvoiceLine, calculateProductPrice } from "@/lib/billing/types";
import { useBilling } from "@/contexts/BillingContext";
import { formatAmount } from "@/lib/bas-accounts";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inline?: boolean;
  documentType?: DocumentType;
  onInvoiceCreated?: (invoice: Invoice) => void;
}

// Helper: format postal code as XXX XX
function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  if (digits.length > 3) return digits.slice(0, 3) + " " + digits.slice(3);
  return digits;
}

// Helper: format org number as XXXXXX-XXXX
function formatOrgNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 6) + "-" + digits.slice(6);
  return digits;
}

// Helper: filter name (no digits)
function filterName(value: string): string {
  return value.replace(/[0-9]/g, "");
}

// Helper: filter phone (no letters)
function filterPhone(value: string): string {
  return value.replace(/[a-zA-ZåäöÅÄÖ]/g, "");
}

// Helper: filter city (no digits)
function filterCity(value: string): string {
  return value.replace(/[0-9]/g, "");
}

export function CreateInvoiceDialog({ open, onOpenChange, inline, documentType = "invoice", onInvoiceCreated }: CreateInvoiceDialogProps) {
  const { customers, products, addCustomer, addProduct, updateProduct, createInvoice } = useBilling();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [inlineCustomer, setInlineCustomer] = useState<Omit<Customer, "id" | "companyId" | "createdAt"> | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [saveCustomerPrompt, setSaveCustomerPrompt] = useState(false);
  const [pendingCustomerData, setPendingCustomerData] = useState<Omit<Customer, "id" | "companyId" | "createdAt"> | null>(null);
  
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [saveProductPrompt, setSaveProductPrompt] = useState(false);
  const [pendingProductData, setPendingProductData] = useState<Omit<Product, "id" | "companyId" | "createdAt"> | null>(null);
  
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [lines, setLines] = useState<Array<{
    productName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    sourceProductId?: string;
  }>>([{ productName: "", description: "", quantity: 1, unitPrice: 0, vatRate: 25 }]);

  // Customer form state
  const [custType, setCustType] = useState<"private" | "company">("company");
  const [custName, setCustName] = useState("");
  const [custOrgNum, setCustOrgNum] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custPostalCode, setCustPostalCode] = useState("");
  const [custCity, setCustCity] = useState("");

  // Product form state
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodVatRate, setProdVatRate] = useState("25");
  const [prodUnit, setProdUnit] = useState("st");
  const [prodIncludesVat, setProdIncludesVat] = useState(false);

  const docLabel = documentType === "quote" ? "Quote" : "Invoice";

  const getCustomerDisplay = () => {
    if (inlineCustomer) return inlineCustomer.name;
    if (selectedCustomerId) {
      const c = customers.find(c => c.id === selectedCustomerId);
      return c?.name || "";
    }
    return "";
  };

  const getCustomerData = (): { name: string; address: string; id: string } | null => {
    if (inlineCustomer) {
      return { name: inlineCustomer.name, address: `${inlineCustomer.address}, ${inlineCustomer.postalCode} ${inlineCustomer.city}`, id: "inline" };
    }
    if (selectedCustomerId) {
      const c = customers.find(c => c.id === selectedCustomerId);
      if (c) return { name: c.name, address: `${c.address}, ${c.postalCode} ${c.city}`, id: c.id };
    }
    return null;
  };

  const handleConfirmInlineCustomer = () => {
    if (!custName.trim() || !custAddress.trim() || !custPostalCode.trim() || !custCity.trim()) {
      toast.error("Please fill in all required customer fields");
      return;
    }
    if (custType === "company" && custOrgNum.replace(/\D/g, "").length !== 10) {
      toast.error("Organization number must be 10 digits (XXXXXX-XXXX)");
      return;
    }
    const postalDigits = custPostalCode.replace(/\D/g, "");
    if (postalDigits.length !== 5) {
      toast.error("Postal code must be 5 digits");
      return;
    }
    const data: Omit<Customer, "id" | "companyId" | "createdAt"> = {
      type: custType, name: custName.trim(),
      organizationNumber: custType === "company" ? custOrgNum : undefined,
      email: custEmail.trim() || undefined, phone: custPhone.trim() || undefined,
      address: custAddress.trim(), postalCode: formatPostalCode(custPostalCode),
      city: custCity.trim(), country: "Sweden",
    };
    setShowNewCustomerForm(false);
    setPendingCustomerData(data);
    setSaveCustomerPrompt(true);
  };

  const handleSaveCustomerDecision = (save: boolean) => {
    if (pendingCustomerData) {
      if (save) {
        const saved = addCustomer(pendingCustomerData);
        setSelectedCustomerId(saved.id);
        setInlineCustomer(null);
        toast.success("Customer saved to your customer list");
      } else {
        setInlineCustomer(pendingCustomerData);
        setSelectedCustomerId("");
      }
    }
    setSaveCustomerPrompt(false);
    setPendingCustomerData(null);
  };

  const handleConfirmInlineProduct = () => {
    if (!prodName.trim() || !prodPrice || parseFloat(prodPrice) <= 0) {
      toast.error("Please fill in product name and price");
      return;
    }
    const data: Omit<Product, "id" | "companyId" | "createdAt"> = {
      name: prodName.trim(), description: prodDescription.trim() || undefined,
      price: parseFloat(prodPrice), includesVat: prodIncludesVat,
      vatRate: parseFloat(prodVatRate), unit: prodUnit,
    };
    setShowNewProductForm(false);
    setPendingProductData(data);
    setSaveProductPrompt(true);
  };

  const handleSaveProductDecision = (save: boolean) => {
    if (pendingProductData) {
      const calc = calculateProductPrice(pendingProductData.price, pendingProductData.includesVat, pendingProductData.vatRate);
      if (save) {
        addProduct(pendingProductData);
        toast.success("Product saved to your product list");
      }
      setLines(prev => [...prev.filter(l => l.productName), {
        productName: pendingProductData.name,
        description: pendingProductData.description || "",
        quantity: 1, unitPrice: calc.priceExclVat, vatRate: pendingProductData.vatRate,
      }]);
    }
    setSaveProductPrompt(false);
    setPendingProductData(null);
  };

  const handleAddExistingProduct = (productId: string, lineIndex?: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const calc = calculateProductPrice(product.price, product.includesVat, product.vatRate);
    const newLine = {
      productName: product.name, description: product.description || "",
      quantity: 1, unitPrice: calc.priceExclVat, vatRate: product.vatRate,
      sourceProductId: product.id,
    };
    if (lineIndex !== undefined) {
      setLines(prev => prev.map((l, i) => i === lineIndex ? newLine : l));
    } else {
      setLines(prev => [...prev.filter(l => l.productName), newLine]);
    }
  };

  const handleAddProductFromLine = (index: number) => {
    const line = lines[index];
    if (!line.productName.trim() || line.unitPrice <= 0) return;
    const newProduct = addProduct({
      name: line.productName.trim(),
      description: line.description.trim() || undefined,
      price: line.unitPrice,
      includesVat: false,
      vatRate: line.vatRate,
      unit: "st",
    });
    updateLine(index, "sourceProductId", newProduct.id);
    toast.success(`Product "${line.productName}" added`);
  };

  const handleUpdateProductFromLine = (index: number) => {
    const line = lines[index];
    if (!line.sourceProductId) return;
    const existingProduct = products.find(p => p.id === line.sourceProductId);
    if (!existingProduct) return;
    updateProduct({
      ...existingProduct,
      name: line.productName.trim(),
      description: line.description.trim() || undefined,
      price: line.unitPrice,
      vatRate: line.vatRate,
    });
    toast.success(`Product "${line.productName}" updated`);
  };

  const isLineFromExistingProduct = (index: number) => {
    const line = lines[index];
    return !!line.sourceProductId && products.some(p => p.id === line.sourceProductId);
  };

  const hasLinePriceChanged = (index: number) => {
    const line = lines[index];
    if (!line.sourceProductId) return false;
    const product = products.find(p => p.id === line.sourceProductId);
    if (!product) return false;
    const calc = calculateProductPrice(product.price, product.includesVat, product.vatRate);
    return calc.priceExclVat !== line.unitPrice || product.vatRate !== line.vatRate;
  };

  const canAddAsProduct = (index: number) => {
    const line = lines[index];
    return line.productName.trim() !== "" && line.unitPrice > 0 && !isLineFromExistingProduct(index);
  };

  const updateLine = (index: number, field: string, value: any) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyLine = () => {
    setLines(prev => [...prev, { productName: "", description: "", quantity: 1, unitPrice: 0, vatRate: 25 }]);
  };

  const invoiceLines: InvoiceLine[] = lines.filter(l => l.productName).map((l) => {
    const calc = calculateInvoiceLine(l.quantity, l.unitPrice, l.vatRate);
    return {
      id: crypto.randomUUID(), productId: "", productName: l.productName,
      description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
      vatRate: l.vatRate, ...calc,
    };
  });

  const subtotal = invoiceLines.reduce((s, l) => s + l.totalExclVat, 0);
  const totalVat = invoiceLines.reduce((s, l) => s + l.vatAmount, 0);
  const total = invoiceLines.reduce((s, l) => s + l.totalInclVat, 0);

  const handleCreateInvoice = () => {
    const customer = getCustomerData();
    if (!customer) { toast.error("Please select or create a customer"); return; }
    if (invoiceLines.length === 0) { toast.error("Please add at least one line item"); return; }

    const created = createInvoice({
      documentType,
      customerId: customer.id, customerName: customer.name, customerAddress: customer.address,
      issueDate: format(issueDate, "yyyy-MM-dd"), dueDate: format(dueDate, "yyyy-MM-dd"),
      lines: invoiceLines, subtotal, totalVat, total, status: "draft",
    });

    toast.success(`${docLabel} created`);
    onOpenChange(false);
    setSelectedCustomerId("");
    setInlineCustomer(null);
    setLines([{ productName: "", description: "", quantity: 1, unitPrice: 0, vatRate: 25 }]);
    onInvoiceCreated?.(created);
  };

  const formContent = (
    <div className="space-y-4">
      {/* Customer + Dates */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-xs font-semibold">Customer</Label>
          {customers.length > 0 ? (
            <Select value={selectedCustomerId} onValueChange={(v) => { setSelectedCustomerId(v); setInlineCustomer(null); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 flex items-center text-sm text-muted-foreground border rounded-md px-3 bg-muted/30">No customers yet</div>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5 w-auto" onClick={() => setShowNewCustomerForm(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" />New Customer
          </Button>
        </div>
        <div className="w-[160px] shrink-0 space-y-1.5">
          <div className="border border-border rounded-lg p-2.5 space-y-2.5 bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Issue Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-full justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(issueDate, "yyyy-MM-dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={issueDate} onSelect={(d) => d && setIssueDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-full justify-start text-left font-normal text-sm">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(dueDate, "yyyy-MM-dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={(d) => d && setDueDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {getCustomerDisplay() && (
        <p className="text-xs text-muted-foreground">Customer: <span className="text-foreground font-medium">{getCustomerDisplay()}</span></p>
      )}

      {/* Line Items */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Line Items</Label>

        {lines.map((line, index) => (
          <div key={index} className="border rounded-lg p-2 bg-muted/20 space-y-1 relative">
            {canAddAsProduct(index) && (
              <div className="absolute top-1 right-1">
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => handleAddProductFromLine(index)}>
                  <Plus className="h-3 w-3 mr-0.5" />Add Product
                </Button>
              </div>
            )}
            {isLineFromExistingProduct(index) && hasLinePriceChanged(index) && (
              <div className="absolute top-1 right-1">
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => handleUpdateProductFromLine(index)}>
                  Update Product
                </Button>
              </div>
            )}
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Name</Label>
                {products.length > 0 ? (
                  <Select 
                    value={line.sourceProductId || "__custom__"} 
                    onValueChange={(v) => {
                      if (v === "__custom__") {
                        updateLine(index, "productName", "");
                        updateLine(index, "sourceProductId", undefined);
                      } else {
                        handleAddExistingProduct(v, index);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select product...">
                        {line.productName || "Select product..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Custom item...</SelectItem>
                      {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={line.productName} onChange={e => updateLine(index, "productName", e.target.value)} placeholder="Item name" className="h-9 text-sm" />
                )}
                {(line.sourceProductId === undefined || !products.some(p => p.id === line.sourceProductId)) && products.length > 0 && (
                  <Input value={line.productName} onChange={e => updateLine(index, "productName", e.target.value)} placeholder="Enter item name" className="mt-1 h-9 text-sm" />
                )}
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={line.description} onChange={e => updateLine(index, "description", e.target.value)} placeholder="Optional" className="h-9 text-sm" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="1" value={line.quantity} onChange={e => updateLine(index, "quantity", parseInt(e.target.value) || 1)} className="h-9 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Price (excl VAT)</Label>
                <Input type="number" min="0" step="1" value={line.unitPrice || ""} onChange={e => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)} onFocus={e => { if (e.target.value === "0") e.target.value = ""; }} placeholder="0" className="h-9 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">VAT %</Label>
                <Select value={line.vatRate.toString()} onValueChange={v => updateLine(index, "vatRate", parseFloat(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="6">6%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="25">25%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLine(index)} disabled={lines.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addEmptyLine}>
          <Plus className="h-4 w-4 mr-2" />Add Line
        </Button>
      </div>

      {/* Totals */}
      {invoiceLines.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (excl. VAT):</span>
            <span className="font-mono">{formatAmount(subtotal)} SEK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total VAT:</span>
            <span className="font-mono">{formatAmount(totalVat)} SEK</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Total (incl. VAT):</span>
            <span className="font-mono">{formatAmount(total)} SEK</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
        <Button type="button" onClick={handleCreateInvoice} className="flex-1">Create {docLabel}</Button>
      </div>
    </div>
  );

  const subDialogs = (
    <>
      {/* New Customer Form Dialog */}
      <Dialog open={showNewCustomerForm} onOpenChange={setShowNewCustomerForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Customer for {docLabel}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Type *</Label>
              <Select value={custType} onValueChange={v => setCustType(v as "private" | "company")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private Person</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={custName} onChange={e => setCustName(filterName(e.target.value))} placeholder="Customer name" />
            </div>
            {custType === "company" && (
              <div className="space-y-2">
                <Label>Organization Number *</Label>
                <Input value={custOrgNum} onChange={e => setCustOrgNum(formatOrgNumber(e.target.value))} placeholder="XXXXXX-XXXX" maxLength={11} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="email@example.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={custPhone} onChange={e => setCustPhone(filterPhone(e.target.value))} placeholder="+46 70 123 45 67" /></div>
            </div>
            <div className="space-y-2"><Label>Address *</Label><Input value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="Street address" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Postal Code *</Label>
                <Input value={custPostalCode} onChange={e => setCustPostalCode(formatPostalCode(e.target.value))} placeholder="XXX XX" maxLength={6} />
              </div>
              <div className="space-y-2">
                <Label>City *</Label>
                <Input value={custCity} onChange={e => setCustCity(filterCity(e.target.value))} placeholder="Stockholm" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value="Sweden" disabled className="bg-muted" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewCustomerForm(false)} className="flex-1">Cancel</Button>
              <Button type="button" onClick={handleConfirmInlineCustomer} className="flex-1">Use Customer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Product Form Dialog */}
      <Dialog open={showNewProductForm} onOpenChange={setShowNewProductForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Product for {docLabel}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Product/Service Name *</Label><Input value={prodName} onChange={e => setProdName(e.target.value)} placeholder="Consulting Service" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={prodDescription} onChange={e => setProdDescription(e.target.value)} placeholder="Optional" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Price *</Label><Input type="number" min="0" step="1" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={prodUnit} onValueChange={setProdUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="st">st (piece)</SelectItem>
                    <SelectItem value="tim">tim (hour)</SelectItem>
                    <SelectItem value="dag">dag (day)</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="m">m (meter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select value={prodIncludesVat ? "incl" : "excl"} onValueChange={v => setProdIncludesVat(v === "incl")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excl">Price excl. VAT</SelectItem>
                  <SelectItem value="incl">Price incl. VAT</SelectItem>
                </SelectContent>
              </Select>
              <Select value={prodVatRate} onValueChange={setProdVatRate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No VAT (0%)</SelectItem>
                  <SelectItem value="6">6% VAT</SelectItem>
                  <SelectItem value="12">12% VAT</SelectItem>
                  <SelectItem value="25">25% VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewProductForm(false)} className="flex-1">Cancel</Button>
              <Button type="button" onClick={handleConfirmInlineProduct} className="flex-1">Add to {docLabel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Customer Prompt */}
      <AlertDialog open={saveCustomerPrompt} onOpenChange={setSaveCustomerPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Customer?</AlertDialogTitle>
            <AlertDialogDescription>Would you like to save <strong>{pendingCustomerData?.name}</strong> to your customer list?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleSaveCustomerDecision(false)}>No, just use for this {docLabel.toLowerCase()}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSaveCustomerDecision(true)}>Yes, save to customer list</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Product Prompt */}
      <AlertDialog open={saveProductPrompt} onOpenChange={setSaveProductPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Product?</AlertDialogTitle>
            <AlertDialogDescription>Would you like to save <strong>{pendingProductData?.name}</strong> to your product list?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleSaveProductDecision(false)}>No, just use for this {docLabel.toLowerCase()}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSaveProductDecision(true)}>Yes, save to product list</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Inline mode: render as a card within the page
  if (inline && open) {
    return (
      <>
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Create {docLabel}</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">{formContent}</CardContent>
        </Card>
        {subDialogs}
      </>
    );
  }

  // Dialog mode (fallback)
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create {docLabel}</DialogTitle></DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
      {subDialogs}
    </>
  );
}
