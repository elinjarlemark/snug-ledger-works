import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  FileText,
  Users,
  FileCheck,
  BarChart3,
  Wallet,
  ArrowRight,
} from "lucide-react";

const economyModules = [
  {
    icon: BookOpen,
    name: "Accounting",
    description:
      "Core double-entry bookkeeping with full Swedish BAS compliance. Create balanced vouchers, manage accounts, and maintain accurate records.",
    href: "/economy/accounting",
    features: ["Voucher management", "BAS chart of accounts", "Balance validation"],
  },
  {
    icon: FileText,
    name: "Billing",
    description:
      "Create, send, and track invoices. Manage customer payments and maintain a clear overview of receivables.",
    href: "/economy/billing",
    features: ["Invoice creation", "Payment tracking", "Customer management"],
  },
  {
    icon: Users,
    name: "Salary",
    description:
      "Handle payroll processing, employee records, and salary-related bookkeeping entries.",
    href: "/economy/salary",
    features: ["Payroll processing", "Employee records", "Tax calculations"],
  },
  {
    icon: FileCheck,
    name: "Declaration",
    description:
      "Prepare and submit tax declarations with confidence. Generate required reports and ensure compliance.",
    href: "/economy/declaration",
    features: ["VAT declarations", "Tax reporting", "Compliance checks"],
  },
  {
    icon: BarChart3,
    name: "Annual Reports",
    description:
      "Generate income statements, balance sheets, and complete annual reports for statutory compliance.",
    href: "/economy/annual-reports",
    features: ["Income statements", "Balance sheets", "Year-end closing"],
  },
  {
    icon: Wallet,
    name: "Accounts",
    description:
      "Manage your chart of accounts. View, add, and configure bookkeeping accounts based on the BAS standard.",
    href: "/economy/accounts",
    features: ["Account listing", "BAS compliance", "Account configuration"],
  },
];

export default function EconomyIndex() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Economy Overview</h1>
        <p className="text-lg text-muted-foreground">
          A complete suite of tools for Swedish business accounting. Explore each module to learn more.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {economyModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <div
              key={module.name}
              className="feature-card animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-secondary" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {module.name}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-4">
                {module.description}
              </p>
              
              <ul className="space-y-2 mb-6">
                {module.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <Button variant="outline" className="w-full" asChild>
                <Link to={module.href}>
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
