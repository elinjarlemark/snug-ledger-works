import { FileText, Send, CreditCard, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const billingFeatures = [
  {
    icon: FileText,
    title: "Invoice Creation",
    description:
      "Create professional invoices with all required fields. Include customer details, line items, VAT calculations, and payment terms.",
  },
  {
    icon: Send,
    title: "Invoice Delivery",
    description:
      "Send invoices directly to customers via email or download as PDF for traditional delivery methods.",
  },
  {
    icon: CreditCard,
    title: "Payment Tracking",
    description:
      "Track invoice status from sent to paid. Record payments and automatically create bookkeeping entries.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description:
      "Maintain a customer database with contact information, payment history, and outstanding balances.",
  },
];

const invoiceFields = [
  "Invoice number (automatic)",
  "Invoice date",
  "Due date",
  "Customer information",
  "Line items with descriptions",
  "Quantities and unit prices",
  "VAT rates and amounts",
  "Total amounts",
  "Payment instructions",
];

export default function BillingPage() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Billing</h1>
            <p className="text-muted-foreground">
              Invoice management and payment tracking
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Streamlined Invoicing
        </h2>
        <p className="text-muted-foreground mb-4">
          The Billing module provides a complete solution for managing customer invoices. Create professional invoices, track payments, and maintain a clear overview of your receivables.
        </p>
        <p className="text-muted-foreground">
          All invoices automatically integrate with the accounting module, creating proper bookkeeping entries when invoices are created and when payments are received.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Billing Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {billingFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="feature-card">
                <Icon className="h-8 w-8 text-secondary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoice Content */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Invoice Content
        </h2>
        <p className="text-muted-foreground mb-6">
          Each invoice includes all fields required for Swedish business invoicing:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {invoiceFields.map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-sm">{field}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Login Prompt */}
      <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Create Invoices
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign in to start creating and managing invoices for your customers. Track payments and maintain clear receivables records.
            </p>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
