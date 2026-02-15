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
import { Customer, Product, InvoiceLine, Invoice, calculateInvoiceLine, calculateProductPrice } from "@/lib/billing/types";
import { useBilling } from "@/contexts/BillingContext";
import { formatAmount } from "@/lib/bas-accounts";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inline?: boolean;
}

export function CreateInvoiceDialog({ open, onOpenChange, inline }: CreateInvoiceDialogProps) {
  const { customers, products, addCustomer, addProduct, createInvoice } = useBilling();
  
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
  const [custCountry, setCustCountry] = useState("Sweden");

  // Product form state
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodVatRate, setProdVatRate] = useState("25");
  const [prodUnit, setProdUnit] = useState("st");
  const [prodIncludesVat, setProdIncludesVat] = useState(false);

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
    const data: Omit<Customer, "id" | "companyId" | "createdAt"> = {
      type: custType, name: custName.trim(),
      organizationNumber: custType === "company" ? custOrgNum : undefined,
      email: custEmail.trim() || undefined, phone: custPhone.trim() || undefined,
      address: custAddress.trim(), postalCode: custPostalCode.trim(),
      city: custCity.trim(), country: custCountry.trim(),
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

  const handleAddExistingProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const calc = calculateProductPrice(product.price, product.includesVat, product.vatRate);
    setLines(prev => [...prev.filter(l => l.productName), {
      productName: product.name, description: product.description || "",
      quantity: 1, unitPrice: calc.priceExclVat, vatRate: product.vatRate,
    }]);
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

    createInvoice({
      customerId: customer.id, customerName: customer.name, customerAddress: customer.address,
      issueDate: format(issueDate, "yyyy-MM-dd"), dueDate: format(dueDate, "yyyy-MM-dd"),
      lines: invoiceLines, subtotal, totalVat, total, status: "draft",
    });

    toast.success("Invoice created");
    onOpenChange(false);
    setSelectedCustomerId("");
    setInlineCustomer(null);
    setLines([{ productName: "", description: "", quantity: 1, unitPrice: 0, vatRate: 25 }]);
  };

  const formContent = (
    <div className="space-y-6">
      {/* Customer Section */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Customer</Label>
        <div className="flex gap-2">
          {customers.length > 0 && (
            <Select value={selectedCustomerId} onValueChange={(v) => { setSelectedCustomerId(v); setInlineCustomer(null); }}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select existing customer..." /></SelectTrigger>
              <SelectContent>
                {customers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" variant="outline" onClick={() => setShowNewCustomerForm(true)}>
            <UserPlus className="h-4 w-4 mr-2" />New Customer
          </Button>
        </div>
        {getCustomerDisplay() && (
          <p className="text-sm text-muted-foreground">Customer: <span className="text-foreground font-medium">{getCustomerDisplay()}</span></p>
        )}
      </div>

      {/* Dates with Calendar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Issue Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(issueDate, "yyyy-MM-dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={issueDate} onSelect={(d) => d && setIssueDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dueDate, "yyyy-MM-dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={(d) => d && setDueDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Line Items</Label>
          <div className="flex gap-2">
            {products.length > 0 && (
              <Select onValueChange={handleAddExistingProduct}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Add product..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNewProductForm(true)}>
              <Package className="h-4 w-4 mr-2" />New Product
            </Button>
          </div>
        </div>

        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/20">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={line.productName} onChange={e => updateLine(index, "productName", e.target.value)} placeholder="Item name" />
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={line.description} onChange={e => updateLine(index, "description", e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-1 space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input type="number" min="1" value={line.quantity} onChange={e => updateLine(index, "quantity", parseInt(e.target.value) || 1)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Price (excl VAT)</Label>
              <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">VAT %</Label>
              <Select value={line.vatRate.toString()} onValueChange={v => updateLine(index, "vatRate", parseFloat(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="6">6%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={lines.length <= 1}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addEmptyLine}>
          <Plus className="h-4 w-4 mr-2" />Add Line
        </Button>
      </div>

      {/* Totals */}
      {invoiceLines.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (excl. VAT):</span>
            <span className="font-mono">{formatAmount(subtotal)} SEK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total VAT:</span>
            <span className="font-mono">{formatAmount(totalVat)} SEK</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total (incl. VAT):</span>
            <span className="font-mono">{formatAmount(total)} SEK</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
        <Button type="button" onClick={handleCreateInvoice} className="flex-1">Create Invoice</Button>
      </div>
    </div>
  );

  const subDialogs = (
    <>
      {/* New Customer Form Dialog */}
      <Dialog open={showNewCustomerForm} onOpenChange={setShowNewCustomerForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Customer for Invoice</DialogTitle></DialogHeader>
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
            <div className="space-y-2"><Label>Name *</Label><Input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" /></div>
            {custType === "company" && (
              <div className="space-y-2"><Label>Organization Number</Label><Input value={custOrgNum} onChange={e => setCustOrgNum(e.target.value)} placeholder="XXXXXX-XXXX" /></div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="email@example.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="+46 70 123 45 67" /></div>
            </div>
            <div className="space-y-2"><Label>Address *</Label><Input value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="Street address" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Postal Code *</Label><Input value={custPostalCode} onChange={e => setCustPostalCode(e.target.value)} placeholder="123 45" /></div>
              <div className="space-y-2"><Label>City *</Label><Input value={custCity} onChange={e => setCustCity(e.target.value)} placeholder="Stockholm" /></div>
              <div className="space-y-2"><Label>Country</Label><Input value={custCountry} onChange={e => setCustCountry(e.target.value)} /></div>
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
          <DialogHeader><DialogTitle>New Product for Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Product/Service Name *</Label><Input value={prodName} onChange={e => setProdName(e.target.value)} placeholder="Consulting Service" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={prodDescription} onChange={e => setProdDescription(e.target.value)} placeholder="Optional" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Price *</Label><Input type="number" min="0" step="0.01" value={prodPrice} onChange={e => setProdPrice(e.target.value)} placeholder="0.00" /></div>
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
              <Button type="button" onClick={handleConfirmInlineProduct} className="flex-1">Add to Invoice</Button>
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
            <AlertDialogCancel onClick={() => handleSaveCustomerDecision(false)}>No, just use for this invoice</AlertDialogCancel>
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
            <AlertDialogCancel onClick={() => handleSaveProductDecision(false)}>No, just use for this invoice</AlertDialogCancel>
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
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create Invoice</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>{formContent}</CardContent>
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
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
      {subDialogs}
    </>
  );
}
