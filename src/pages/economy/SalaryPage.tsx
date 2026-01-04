import { Users, Calculator, FileText, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const salaryFeatures = [
  {
    icon: Users,
    title: "Employee Management",
    description:
      "Maintain complete employee records including personal details, employment terms, and salary information.",
  },
  {
    icon: Calculator,
    title: "Payroll Calculation",
    description:
      "Calculate gross pay, taxes, social contributions, and net pay according to Swedish regulations.",
  },
  {
    icon: FileText,
    title: "Salary Slips",
    description:
      "Generate detailed salary slips for each pay period with all required information for employees.",
  },
  {
    icon: Calendar,
    title: "Pay Period Management",
    description:
      "Handle monthly pay periods with proper accruals and timing for taxes and contributions.",
  },
];

const payrollComponents = [
  {
    category: "Earnings",
    items: ["Base salary", "Overtime", "Bonuses", "Benefits"],
  },
  {
    category: "Deductions",
    items: ["Income tax", "Pension contributions", "Union fees"],
  },
  {
    category: "Employer Costs",
    items: ["Employer contributions", "Pension premiums", "Insurance"],
  },
];

export default function SalaryPage() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Salary</h1>
            <p className="text-muted-foreground">
              Payroll processing and employee management
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Complete Payroll Solution
        </h2>
        <p className="text-muted-foreground mb-4">
          The Salary module handles all aspects of payroll processing for Swedish businesses. From employee records to salary calculations and bookkeeping integration.
        </p>
        <p className="text-muted-foreground">
          All salary-related transactions automatically generate proper accounting entries, ensuring accurate records of wage expenses, tax liabilities, and employer contributions.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Payroll Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {salaryFeatures.map((feature) => {
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

      {/* Payroll Components */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Payroll Components
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {payrollComponents.map((component) => (
            <div key={component.category}>
              <h3 className="font-semibold text-foreground mb-3">
                {component.category}
              </h3>
              <ul className="space-y-2">
                {component.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-muted-foreground text-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    {item}
                  </li>
                ))}
              </ul>
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
              Process Payroll
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign in to manage employees and process payroll. Calculate salaries, generate pay slips, and handle employer contributions.
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
