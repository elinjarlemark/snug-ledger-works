import { useState, useEffect } from "react";
import { FileText, Users, Package, Plus, Trash2, Edit, Receipt, Eye, X, Calendar, Send, Download, Mail, CheckCircle, DollarSign, FileCog, Settings, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/contexts/BillingContext";
import { Customer, Product, Invoice, DocumentType, calculateProductPrice } from "@/lib/billing/types";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { formatAmount } from "@/lib/bas-accounts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CreateInvoiceDialog } from "@/components/billing/CreateInvoiceDialog";
import { exportInvoicePDF } from "@/lib/pdf-export";
import { useAccounting } from "@/contexts/AccountingContext";
import { TemplateFormDialog, ExistingTemplatesDialog } from "@/components/billing/VoucherTemplateManager";
import { buildVoucherFromTemplate, isTemplateBalanced } from "@/lib/billing/applyTemplate";
import { VoucherTemplate } from "@/lib/billing/types";
import { BillingSettingsDialog, FirstInvoiceNumberPrompt } from "@/components/billing/BillingSettingsDialog";
import { RecurringInvoiceManager } from "@/components/billing/RecurringInvoiceManager";

// Helper functions for input validation
function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  if (digits.length > 3) return digits.slice(0, 3) + " " + digits.slice(3);
  return digits;
}

function formatOrgNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 6) + "-" + digits.slice(6);
  return digits;
}

function filterName(value: string): string {
  return value.replace(/[0-9]/g, "");
}

function filterPhone(value: string): string {
  return value.replace(/[a-zA-ZåäöÅÄÖ]/g, "");
}

function filterCity(value: string): string {
  return value.replace(/[0-9]/g, "");
}

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!address.trim()) { toast.error("Address is required"); return; }
    const postalDigits = postalCode.replace(/\D/g, "");
    if (postalDigits.length !== 5) { toast.error("Postal code must be 5 digits"); return; }
    if (!city.trim()) { toast.error("City is required"); return; }
    if (type === "company" && organizationNumber.replace(/\D/g, "").length !== 10) {
      toast.error("Organization number must be 10 digits (XXXXXX-XXXX)");
      return;
    }

    onSubmit({
      type,
      name: name.trim(),
      organizationNumber: type === "company" ? organizationNumber : undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim(),
      postalCode: formatPostalCode(postalCode),
      city: city.trim(),
      country: "Sweden",
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
        <Input id="name" value={name} onChange={(e) => setName(filterName(e.target.value))} placeholder={type === "company" ? "Company Name AB" : "John Doe"} required />
      </div>
      {type === "company" && (
        <div className="space-y-2">
          <Label htmlFor="orgNum">Organization Number *</Label>
          <Input id="orgNum" value={organizationNumber} onChange={(e) => setOrganizationNumber(formatOrgNumber(e.target.value))} placeholder="XXXXXX-XXXX" maxLength={11} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(filterPhone(e.target.value))} placeholder="+46 70 123 45 67" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code *</Label>
          <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(formatPostalCode(e.target.value))} placeholder="XXX XX" maxLength={6} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input id="city" value={city} onChange={(e) => setCity(filterCity(e.target.value))} placeholder="Stockholm" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value="Sweden" disabled className="bg-muted" />
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
function InvoiceDetailView({ 
  invoice, 
  onClose, 
  onDelete, 
  onEdit,
  onStatusChange,
  onConvertQuote,
}: { 
  invoice: Invoice; 
  onClose: () => void; 
  onDelete: (id: string) => void;
  onEdit: (invoice: Invoice) => void;
  onStatusChange: (id: string, status: Invoice["status"]) => void;
  onConvertQuote: (quoteId: string) => void;
}) {
  const { activeCompany } = useAuth();
  const navigate = useNavigate();
  const { templates } = useBilling();
  const { createVoucher } = useAccounting();
  const isQuote = invoice.documentType === "quote";
  const docLabel = isQuote ? "Quote" : "Invoice";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);
  const linkedTemplate = invoice.templateId ? templates.find(t => t.id === invoice.templateId) : undefined;

  const handleSendManually = () => {
    exportInvoicePDF(invoice, activeCompany ? {
      companyName: activeCompany.companyName,
      organizationNumber: activeCompany.organizationNumber,
    } : undefined);
    onStatusChange(invoice.id, "sent");
    toast.success(`${docLabel} downloaded as PDF and marked as sent`);
    setShowSendDialog(false);
  };

  const handleSendAutomatically = () => {
    onStatusChange(invoice.id, "sent");
    toast.success(`${docLabel} marked as sent`);
    setShowSendDialog(false);
  };

  const handleMarkPaid = (useAutomatic: boolean) => {
    onStatusChange(invoice.id, "paid");
    setShowPaidConfirm(false);
    toast.success("Invoice marked as paid");
    if (!useAutomatic) return;

    const tpl = linkedTemplate;

    // No template linked — fall back to old prefill flow on the accounting page.
    if (!tpl) {
      const bookingAccount = activeCompany?.invoiceBookingAccount || "1930";
      navigate("/economy/accounting", {
        state: {
          openCreateVoucher: true,
          prefillVoucher: {
            description: `Invoice #${invoice.invoiceNumber} - ${invoice.customerName}`,
            lines: [
              { accountNumber: bookingAccount, accountName: "", debit: invoice.total, credit: 0 },
              { accountNumber: "", accountName: "", debit: 0, credit: invoice.total },
            ],
          },
        },
      });
      return;
    }

    if (!isTemplateBalanced(invoice, tpl)) {
      toast.error("Template is not balanced — opening voucher form to fix");
      const built = buildVoucherFromTemplate(invoice, tpl);
      navigate("/economy/accounting", {
        state: {
          openCreateVoucher: true,
          prefillVoucher: {
            description: built.description,
            lines: built.lines,
          },
        },
      });
      return;
    }

    const built = buildVoucherFromTemplate(invoice, tpl);
    const created = createVoucher({
      date: built.date,
      description: built.description,
      lines: built.lines,
    });
    if (created) {
      toast.success(`Voucher #${created.voucherNumber} created`, {
        description: `From "${tpl.name}" template`,
      });
    } else {
      toast.error("Could not create voucher — please review the template");
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{docLabel} #{invoice.invoiceNumber}</h2>
          <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isQuote && invoice.status !== "accepted" && (
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onConvertQuote(invoice.id)}>
              <CheckCircle className="h-4 w-4 mr-1" />Quote Accepted
            </Button>
          )}
          {!isQuote && invoice.status === "sent" && (
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowPaidConfirm(true)}>
              <DollarSign className="h-4 w-4 mr-1" />Paid
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onEdit(invoice)}>
            <Edit className="h-4 w-4 mr-1" />Edit
          </Button>
          {invoice.status === "sent" || invoice.status === "paid" ? (
            <Button size="sm" onClick={() => {
              exportInvoicePDF(invoice, activeCompany ? {
                companyName: activeCompany.companyName,
                organizationNumber: activeCompany.organizationNumber,
              } : undefined);
              toast.success("PDF saved");
            }}>
              <Download className="h-4 w-4 mr-1" />Save
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowSendDialog(true)}>
              <Send className="h-4 w-4 mr-1" />Send
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-1" />Delete
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Issue Date</p>
          <p className="font-medium">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{isQuote ? "Valid Until" : "Due Date"}</p>
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
            invoice.status === "accepted" ? "bg-success/10 text-success" :
            invoice.status === "overdue" ? "bg-destructive/10 text-destructive" :
            invoice.status === "declined" ? "bg-destructive/10 text-destructive" :
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

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {docLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {docLabel.toLowerCase()} #{invoice.invoiceNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDelete(invoice.id); onClose(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paid Confirmation - Automatic booking? */}
      <AlertDialog open={showPaidConfirm} onOpenChange={setShowPaidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invoice Paid</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedTemplate
                ? `Use automatic booking with the linked template "${linkedTemplate.name}"?`
                : "Do you want to create a voucher for this invoice? You can link a template when creating the invoice to make this fully automatic."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleMarkPaid(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleMarkPaid(true)}>
              {linkedTemplate ? "Yes, book automatically" : "Yes, open voucher form"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {docLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how to send this {docLabel.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={handleSendManually}>
              <Download className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Send Manually</p>
                <p className="text-xs text-muted-foreground">Download as PDF and send it yourself</p>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 opacity-50 cursor-not-allowed" disabled>
              <Mail className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Send Automatically via Email</p>
                <p className="text-xs text-muted-foreground">Coming Soon</p>
              </div>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { customers, products, invoices, templates, firstInvoiceNumberSet, addCustomer, updateCustomer, deleteCustomer, addProduct, updateProduct, deleteProduct, deleteInvoice, updateInvoiceStatus, convertQuoteToInvoice } = useBilling();
  const location = useLocation();

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<VoucherTemplate | undefined>();
  const [existingTemplatesOpen, setExistingTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recurringManagerOpen, setRecurringManagerOpen] = useState(false);
  const [firstNumberPromptOpen, setFirstNumberPromptOpen] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<any | undefined>(undefined);

  // Compute display status: only sent invoices can become overdue
  const getDisplayStatus = (inv: Invoice) => {
    if (inv.status === "sent" && inv.dueDate) {
      const today = new Date().toISOString().split("T")[0];
      if (inv.dueDate < today) return "overdue";
    }
    // Draft invoices never become overdue even if past due date
    return inv.status;
  };

  const actualInvoices = invoices.filter(i => (i.documentType || "invoice") === "invoice");
  const quotes = invoices.filter(i => i.documentType === "quote");

  useEffect(() => {
    const state = location.state as any;
    if (state?.openCreateInvoice) {
      if (state.invoicePrefill) setInvoicePrefill(state.invoicePrefill);
      // First-invoice prompt only when there's no prefill (recurring flow already implies the user knows what they're doing).
      if (!state.invoicePrefill && !firstInvoiceNumberSet) {
        setFirstNumberPromptOpen(true);
      } else {
        setShowCreateInvoice(true);
      }
    }
  }, [location.state, firstInvoiceNumberSet]);

  const handleCreateInvoiceClick = () => {
    if (!firstInvoiceNumberSet) {
      setFirstNumberPromptOpen(true);
    } else {
      setInvoicePrefill(undefined);
      setShowCreateInvoice(true);
    }
  };

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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Billing</h1>
            <p className="text-sm text-muted-foreground">Invoice management and payment tracking</p>
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold gradient-text">Billing</h1>
        <p className="text-sm text-muted-foreground">Hantera fakturor, offerter, kunder & produkter.</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Invoices ({actualInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="quotes" className="gap-2">
            <Send className="h-4 w-4" />
            Quotes ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products ({products.length})
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
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            <div className="grid gap-4 md:grid-cols-2 auto-rows-fr">
              {customers.map((customer) => (
                <Card key={customer.id} className="border-border/60 shadow-card hover:shadow-md hover:border-secondary/30 transition-all hover-lift flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{customer.name}</CardTitle>
                        <CardDescription>
                          {customer.type === "company" ? "Company" : "Private Person"}
                          {customer.organizationNumber && ` • ${customer.organizationNumber}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCustomer(customer); setCustomerDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDeleteCustomer(customer.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground flex-1">
                    <p>{customer.address}</p>
                    <p>{customer.postalCode} {customer.city}</p>
                    {customer.email && <p className="truncate">{customer.email}</p>}
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
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">Unit</th>
                    <th className="text-right py-2 px-3 font-medium">Price excl. VAT</th>
                    <th className="text-right py-2 px-3 font-medium">VAT</th>
                    <th className="text-right py-2 px-3 font-medium">Price incl. VAT</th>
                    <th className="text-right py-2 px-3 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const calc = calculateProductPrice(product.price, product.includesVat, product.vatRate);
                    return (
                      <tr key={product.id} className="border-b border-border/50">
                        <td className="py-2 px-3">
                          <p className="font-medium text-foreground">{product.name}</p>
                          {product.description && <p className="text-[10px] text-muted-foreground">{product.description}</p>}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{product.unit || "-"}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatAmount(calc.priceExclVat)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{product.vatRate}%</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">{formatAmount(calc.priceInclVat)}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingProduct(product); setProductDialogOpen(true); }}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteProduct(product.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
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
          {showCreateInvoice && (
            <CreateInvoiceDialog
              open={showCreateInvoice}
              onOpenChange={(o) => {
                setShowCreateInvoice(o);
                if (!o) setInvoicePrefill(undefined);
              }}
              inline
              documentType="invoice"
              prefill={invoicePrefill}
              onInvoiceCreated={(inv) => setSelectedInvoice(inv)}
            />
          )}

          {selectedInvoice && !showCreateInvoice && (selectedInvoice.documentType || "invoice") === "invoice" && (
            <InvoiceDetailView
              invoice={selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
              onDelete={(id) => { deleteInvoice(id); toast.success("Invoice deleted"); }}
              onEdit={() => toast.info("Edit functionality coming soon")}
              onStatusChange={(id, status) => { updateInvoiceStatus(id, status); setSelectedInvoice(prev => prev ? { ...prev, status } : null); }}
              onConvertQuote={(id) => { const inv = convertQuoteToInvoice(id); if (inv) { setSelectedInvoice(inv); toast.success("Quote converted to invoice"); } }}
            />
          )}

          {!showCreateInvoice && !selectedInvoice && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Invoices</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <Button variant="outline" onClick={() => setRecurringManagerOpen(true)}>
                    <Repeat className="h-4 w-4 mr-2" />
                    Recurring
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <FileCog className="h-4 w-4 mr-2" />
                        Template
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => { setEditTemplate(undefined); setTemplateFormOpen(true); }}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Create new
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={templates.length === 0}
                        onClick={() => setExistingTemplatesOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Edit existing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={handleCreateInvoiceClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              </div>

              <TemplateFormDialog
                open={templateFormOpen}
                onOpenChange={(o) => { setTemplateFormOpen(o); if (!o) setEditTemplate(undefined); }}
                template={editTemplate}
              />
              <ExistingTemplatesDialog
                open={existingTemplatesOpen}
                onOpenChange={setExistingTemplatesOpen}
                onEdit={(tpl) => { setEditTemplate(tpl); setTemplateFormOpen(true); }}
              />

              {actualInvoices.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No invoices yet. Create your first invoice to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                     <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium">Invoice #</th>
                        <th className="text-left py-2 px-3 font-medium">Customer</th>
                        <th className="text-left py-2 px-3 font-medium">Issue Date</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-right py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actualInvoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <td className="py-2 px-3 font-mono text-secondary">#{invoice.invoiceNumber}</td>
                          <td className="py-2 px-3 text-foreground">{invoice.customerName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{invoice.issueDate}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {formatAmount(invoice.total)} SEK
                          </td>
                          <td className="py-2 px-3 text-right">
                            {(() => {
                              const displayStatus = getDisplayStatus(invoice);
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  displayStatus === "paid" ? "bg-green-500/10 text-green-600" :
                                  displayStatus === "overdue" ? "bg-destructive/10 text-destructive" :
                                  displayStatus === "sent" ? "bg-blue-500/10 text-blue-600" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                                </span>
                              );
                            })()}
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

        {/* Quotes Tab */}
        <TabsContent value="quotes" className="space-y-4">
          {showCreateQuote && (
            <CreateInvoiceDialog
              open={showCreateQuote}
              onOpenChange={setShowCreateQuote}
              inline
              documentType="quote"
              onInvoiceCreated={(inv) => setSelectedInvoice(inv)}
            />
          )}

          {selectedInvoice && !showCreateQuote && selectedInvoice.documentType === "quote" && (
            <InvoiceDetailView
              invoice={selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
              onDelete={(id) => { deleteInvoice(id); toast.success("Quote deleted"); }}
              onEdit={() => toast.info("Edit functionality coming soon")}
              onStatusChange={(id, status) => { updateInvoiceStatus(id, status); setSelectedInvoice(prev => prev ? { ...prev, status } : null); }}
              onConvertQuote={(id) => { const inv = convertQuoteToInvoice(id); if (inv) { setSelectedInvoice(inv); toast.success("Quote accepted and converted to invoice"); } }}
            />
          )}

          {!showCreateQuote && !(selectedInvoice?.documentType === "quote") && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Quotes</h2>
                <Button onClick={() => setShowCreateQuote(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quote
                </Button>
              </div>

              {quotes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No quotes yet. Create your first quote to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium">Quote #</th>
                        <th className="text-left py-2 px-3 font-medium">Customer</th>
                        <th className="text-left py-2 px-3 font-medium">Issue Date</th>
                        <th className="text-right py-2 px-3 font-medium">Total</th>
                        <th className="text-right py-2 px-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote) => (
                        <tr
                          key={quote.id}
                          className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setSelectedInvoice(quote)}
                        >
                          <td className="py-2 px-3 font-mono text-secondary">#{quote.invoiceNumber}</td>
                          <td className="py-2 px-3 text-foreground">{quote.customerName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{quote.issueDate}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {formatAmount(quote.total)} SEK
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              quote.status === "accepted" ? "bg-green-500/10 text-green-600" :
                              quote.status === "declined" ? "bg-destructive/10 text-destructive" :
                              quote.status === "sent" ? "bg-blue-500/10 text-blue-600" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                            </span>
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
