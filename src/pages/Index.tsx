import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Shield,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  FileText,
  Users,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Swedish BAS Compliance",
    description:
      "Full support for the Swedish BAS chart of accounts with proper double-entry bookkeeping.",
  },
  {
    icon: Shield,
    title: "Regulatory Correctness",
    description:
      "Built to meet Swedish bookkeeping standards with balanced vouchers and proper account handling.",
  },
  {
    icon: TrendingUp,
    title: "Financial Reporting",
    description:
      "Generate income statements, balance sheets, and annual reports with confidence.",
  },
];

const capabilities = [
  "Double-entry bookkeeping with balanced vouchers",
  "Complete BAS chart of accounts",
  "Real-time balance validation",
  "Period adjustments and accruals",
  "Year-end closing procedures",
  "Account statements and ledgers",
];

const modules = [
  {
    icon: BookOpen,
    name: "Accounting",
    description: "Core bookkeeping with Swedish compliance",
  },
  {
    icon: FileText,
    name: "Billing",
    description: "Invoice management and tracking",
  },
  {
    icon: Users,
    name: "Salary",
    description: "Payroll and employee management",
  },
  {
    icon: BarChart3,
    name: "Reporting",
    description: "Financial statements and analysis",
  },
];

export default function Index() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-hero text-primary-foreground py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(173_58%_39%/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(173_58%_39%/0.1),transparent_50%)]" />
        
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 text-secondary border border-secondary/30 text-sm font-medium animate-fade-in">
              <span>Swedish Accounting Made Simple</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-balance animate-fade-in-up">
              Professional Accounting for Modern Swedish Businesses
            </h1>
            
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              AccountPro provides a complete, web-based accounting platform built for Swedish BAS compliance. From daily bookkeeping to annual reports.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Button variant="hero" size="xl" asChild>
                <Link to="/economy">
                  Explore Features
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Built for Swedish Standards
            </h2>
            <p className="text-lg text-muted-foreground">
              Every feature designed with Swedish regulatory requirements in mind.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="feature-card animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-secondary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Complete Accounting Engine
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                AccountPro functions as a fully valid Swedish accounting system supporting daily bookkeeping, period adjustments, and year-end procedures.
              </p>
              <ul className="space-y-4">
                {capabilities.map((capability, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-foreground">{capability}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {modules.map((module, index) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.name}
                    className="bg-card rounded-xl p-6 shadow-md border border-border hover:shadow-lg transition-shadow"
                  >
                    <Icon className="h-8 w-8 text-secondary mb-3" />
                    <h4 className="font-semibold text-foreground mb-1">
                      {module.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 bg-gradient-hero text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Streamline Your Accounting?
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Join businesses across Sweden using AccountPro for compliant, efficient bookkeeping.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/economy">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/support">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
