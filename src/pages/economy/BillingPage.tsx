import { useState } from "react";
import { FileText, Users, Package, Plus, Trash2, Edit, Receipt, Eye, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/contexts/BillingContext";
import { Customer, Product, Invoice, calculateProductPrice } from "@/lib/billing/types";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { formatAmount } from "@/lib/bas-accounts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CreateInvoiceDialog } from "@/components/billing/CreateInvoiceDialog";

// Customer Form Component
function CustomerForm({ 
  onSubmit, 
  onCancel, 
  editCustomer 
}: { 
  onSubmit: (customer: Omit<Customer, "id" | "companyId" | "createdAt">) => void; 
  onCancel: () => void;
  editCustomer?: Customer;
}) {
  const [type, setType] = useState<"private" | "company">(editCustomer?.type || "company");
  const [name, setName] = useState(editCustomer?.name || "");
  const [organizationNumber, setOrganizationNumber] = useState(editCustomer?.organizationNumber || "");
  const [email, setEmail] = useState(editCustomer?.email || "");
  const [phone, setPhone] = useState(editCustomer?.phone || "");
  const [address, setAddress] = useState(editCustomer?.address || "");
  const [postalCode, setPostalCode] = useState(editCustomer?.postalCode || "");
  const [city, setCity] = useState(editCustomer?.city || "");
  const [country, setCountry] = useState(editCustomer?.country || "Sweden");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!address.trim()) { toast.error("Address is required"); return; }
    if (!postalCode.trim()) { toast.error("Postal code is required"); return; }
    if (!city.trim()) { toast.error("City is required"); return; }

    onSubmit({
      type,
      name: name.trim(),
      organizationNumber: type === "company" ? organizationNumber : undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      country: country.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Customer Type *</Label>
        <Select value={type} onValueChange={(v) => setType(v as "private" | "company")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Private Person</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "company" ? "Company Name AB" : "John Doe"} required />
      </div>
      {type === "company" && (
        <div className="space-y-2">
          <Label htmlFor="orgNum">Organization Number</Label>
          <Input id="orgNum" value={organizationNumber} onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            if (value.length <= 10) {
              setOrganizationNumber(value.length > 6 ? value.slice(0, 6) + "-" + value.slice(6) : value);
            }
          }} placeholder="XXXXXX-XXXX" maxLength={11} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+46 70 123 45 67" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code *</Label>
          <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="123 45" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stockholm" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Sweden" />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1">{editCustomer ? "Save Changes" : "Add Customer"}</Button>
      </div>
    </form>
  );
}

// Product Form Component
function ProductForm({ 
  onSubmit, 
  onCancel, 
  editProduct 
}: { 
  onSubmit: (product: Omit<Product, "id" | "companyId" | "createdAt">) => void; 
  onCancel: () => void;
  editProduct?: Product;
}) {
  const [name, setName] = useState(editProduct?.name || "");
  const [description, setDescription] = useState(editProduct?.description || "");
  const [price, setPrice] = useState(editProduct?.price?.toString() || "");
  const [includesVat, setIncludesVat] = useState(editProduct?.includesVat ?? false);
  const [vatRate, setVatRate] = useState(editProduct?.vatRate?.toString() || "25");
  const [unit, setUnit] = useState(editProduct?.unit || "st");

  const priceNum = parseFloat(price) || 0;
  const vatRateNum = parseFloat(vatRate) || 0;
  const calculated = calculateProductPrice(priceNum, includesVat, vatRateNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!price || parseFloat(price) <= 0) { toast.error("Valid price is required"); return; }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price),
      includesVat,
      vatRate: vatRateNum,
      unit: unit.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="productName">Product/Service Name *</Label>
        <Input id="productName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Consulting Service" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price *</Label>
          <Input id="price" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
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
      <div className="space-y-2">
        <Label>VAT Settings</Label>
        <div className="grid grid-cols-2 gap-4">
          <Select value={includesVat ? "incl" : "excl"} onValueChange={(v) => setIncludesVat(v === "incl")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excl">Price excl. VAT</SelectItem>
              <SelectItem value="incl">Price incl. VAT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vatRate} onValueChange={setVatRate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No VAT (0%)</SelectItem>
              <SelectItem value="6">6% VAT</SelectItem>
              <SelectItem value="12">12% VAT</SelectItem>
              <SelectItem value="25">25% VAT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {priceNum > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price excl. VAT:</span>
            <span className="font-mono">{formatAmount(calculated.priceExclVat)} SEK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT ({vatRate}%):</span>
            <span className="font-mono">{formatAmount(calculated.vatAmount)} SEK</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Price incl. VAT:</span>
            <span className="font-mono">{formatAmount(calculated.priceInclVat)} SEK</span>
          </div>
        </div>
      )}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1">{editProduct ? "Save Changes" : "Add Product"}</Button>
      </div>
    </form>
  );
}

// Invoice Detail View (inline)
function InvoiceDetailView({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Invoice #{invoice.invoiceNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {invoice.customerName}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Issue Date</p>
          <p className="font-medium">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Due Date</p>
          <p className="font-medium">{invoice.dueDate}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Customer Address</p>
          <p className="font-medium">{invoice.customerAddress}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            invoice.status === "paid" ? "bg-success/10 text-success" :
            invoice.status === "overdue" ? "bg-destructive/10 text-destructive" :
            invoice.status === "sent" ? "bg-secondary/10 text-secondary" :
            "bg-muted text-muted-foreground"
          }`}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Line items */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-sm">
              <th className="text-left p-3 font-medium">Product</th>
              <th className="text-right p-3 font-medium">Qty</th>
              <th className="text-right p-3 font-medium">Unit Price</th>
              <th className="text-right p-3 font-medium">VAT</th>
              <th className="text-right p-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="p-3">
                  <p className="font-medium">{line.productName}</p>
                  {line.description && <p className="text-sm text-muted-foreground">{line.description}</p>}
                </td>
                <td className="p-3 text-right">{line.quantity}</td>
                <td className="p-3 text-right font-mono">{formatAmount(line.unitPrice)}</td>
                <td className="p-3 text-right text-muted-foreground">{line.vatRate}%</td>
                <td className="p-3 text-right font-mono font-semibold">{formatAmount(line.totalInclVat)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={4} className="p-3 font-semibold">Subtotal (excl. VAT)</td>
              <td className="p-3 text-right font-mono">{formatAmount(invoice.subtotal)}</td>
            </tr>
            <tr className="bg-muted/30">
              <td colSpan={4} className="p-3 text-muted-foreground">Total VAT</td>
              <td className="p-3 text-right font-mono">{formatAmount(invoice.totalVat)}</td>
            </tr>
            <tr className="bg-muted/30 border-t border-border">
              <td colSpan={4} className="p-3 font-bold">Total (incl. VAT)</td>
              <td className="p-3 text-right font-mono font-bold">{formatAmount(invoice.total)} SEK</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { customers, products, invoices, addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct } = useBilling();
  
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  const handleAddCustomer = (data: Omit<Customer, "id" | "companyId" | "createdAt">) => {
    if (editingCustomer) {
      updateCustomer({ ...editingCustomer, ...data });
      toast.success("Customer updated");
    } else {
      addCustomer(data);
      toast.success("Customer added");
    }
    setCustomerDialogOpen(false);
    setEditingCustomer(undefined);
  };

  const handleAddProduct = (data: Omit<Product, "id" | "companyId" | "createdAt">) => {
    if (editingProduct) {
      updateProduct({ ...editingProduct, ...data });
      toast.success("Product updated");
    } else {
      addProduct(data);
      toast.success("Product added");
    }
    setProductDialogOpen(false);
    setEditingProduct(undefined);
  };

  const handleDeleteCustomer = (id: string) => {
    deleteCustomer(id);
    toast.success("Customer deleted");
  };

  const handleDeleteProduct = (id: string) => {
    deleteProduct(id);
    toast.success("Product deleted");
  };

  if (!user) {
    return (
      <div className="space-y-12 animate-fade-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Billing</h1>
              <p className="text-muted-foreground">Invoice management and payment tracking</p>
            </div>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Invoices</h3>
              <p className="text-muted-foreground mb-4">Sign in to start creating and managing invoices.</p>
              <Button asChild><Link to="/login">Sign In</Link></Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
          <FileText className="h-6 w-6 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground">Manage customers, products, and invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Customers</h2>
            <Dialog open={customerDialogOpen} onOpenChange={(open) => {
              setCustomerDialogOpen(open);
              if (!open) setEditingCustomer(undefined);
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
                </DialogHeader>
                <CustomerForm
                  onSubmit={handleAddCustomer}
                  onCancel={() => { setCustomerDialogOpen(false); setEditingCustomer(undefined); }}
                  editCustomer={editingCustomer}
                />
              </DialogContent>
            </Dialog>
          </div>
          {customers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No customers yet. Add your first customer to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {customers.map((customer) => (
                <Card key={customer.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{customer.name}</CardTitle>
                        <CardDescription>
                          {customer.type === "company" ? "Company" : "Private Person"}
                          {customer.organizationNumber && ` • ${customer.organizationNumber}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCustomer(customer); setCustomerDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>{customer.address}</p>
                    <p>{customer.postalCode} {customer.city}</p>
                    {customer.email && <p>{customer.email}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Products & Services</h2>
            <Dialog open={productDialogOpen} onOpenChange={(open) => {
              setProductDialogOpen(open);
              if (!open) setEditingProduct(undefined);
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Product</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
                </DialogHeader>
                <ProductForm
                  onSubmit={handleAddProduct}
                  onCancel={() => { setProductDialogOpen(false); setEditingProduct(undefined); }}
                  editProduct={editingProduct}
                />
              </DialogContent>
            </Dialog>
          </div>
          {products.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No products yet. Add your first product or service to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold">Price excl. VAT</th>
                    <th className="text-right py-3 px-4 font-semibold">VAT</th>
                    <th className="text-right py-3 px-4 font-semibold">Price incl. VAT</th>
                    <th className="text-right py-3 px-4 font-semibold w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const calc = calculateProductPrice(product.price, product.includesVat, product.vatRate);
                    return (
                      <tr key={product.id} className="border-b border-border/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{product.unit || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatAmount(calc.priceExclVat)}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{product.vatRate}%</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">{formatAmount(calc.priceInclVat)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setProductDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          {/* Inline Create Invoice Form */}
          {showCreateInvoice && (
            <CreateInvoiceDialog
              open={showCreateInvoice}
              onOpenChange={setShowCreateInvoice}
              inline
            />
          )}

          {/* Invoice Detail View */}
          {selectedInvoice && !showCreateInvoice && (
            <InvoiceDetailView
              invoice={selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
            />
          )}

          {/* Invoice List */}
          {!showCreateInvoice && !selectedInvoice && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Invoices</h2>
                <Button onClick={() => setShowCreateInvoice(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </div>

              {invoices.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No invoices yet. Create your first invoice to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 font-semibold">Invoice #</th>
                        <th className="text-left py-3 px-4 font-semibold">Customer</th>
                        <th className="text-left py-3 px-4 font-semibold">Date</th>
                        <th className="text-left py-3 px-4 font-semibold">Due Date</th>
                        <th className="text-right py-3 px-4 font-semibold">Total</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-center py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <td className="py-3 px-4 font-mono">#{invoice.invoiceNumber}</td>
                          <td className="py-3 px-4">{invoice.customerName}</td>
                          <td className="py-3 px-4">{invoice.issueDate}</td>
                          <td className="py-3 px-4">{invoice.dueDate}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {formatAmount(invoice.total)} SEK
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              invoice.status === "paid" ? "bg-success/10 text-success" :
                              invoice.status === "overdue" ? "bg-destructive/10 text-destructive" :
                              invoice.status === "sent" ? "bg-secondary/10 text-secondary" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
