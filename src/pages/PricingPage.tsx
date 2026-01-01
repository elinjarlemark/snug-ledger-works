import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "299",
    description: "Perfect for freelancers and small businesses just getting started.",
    features: [
      "Up to 100 vouchers/month",
      "Basic invoicing",
      "Income statement & balance sheet",
      "BAS chart of accounts",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Professional",
    price: "599",
    description: "For growing businesses that need complete accounting functionality.",
    features: [
      "Unlimited vouchers",
      "Full invoicing & billing",
      "Salary processing",
      "VAT declarations",
      "Annual reports",
      "Priority support",
      "API access",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For larger organizations with complex accounting needs.",
    features: [
      "Everything in Professional",
      "Multiple companies",
      "Advanced reporting",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "On-site training",
    ],
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose the plan that fits your business. All plans include core accounting features with Swedish BAS compliance.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-xl p-8 border transition-all duration-300",
                plan.highlighted
                  ? "bg-primary text-primary-foreground border-primary shadow-xl scale-105"
                  : "bg-card border-border hover:shadow-lg"
              )}
            >
              <h3
                className={cn(
                  "text-xl font-bold mb-2",
                  plan.highlighted ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {plan.name}
              </h3>
              <div className="mb-4">
                {plan.price === "Custom" ? (
                  <span
                    className={cn(
                      "text-3xl font-bold",
                      plan.highlighted ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    Custom
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "text-4xl font-bold",
                        plan.highlighted ? "text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {plan.price}
                    </span>
                    <span
                      className={cn(
                        "text-sm ml-1",
                        plan.highlighted
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      SEK/month
                    </span>
                  </>
                )}
              </div>
              <p
                className={cn(
                  "text-sm mb-6",
                  plan.highlighted
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {plan.description}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "h-5 w-5 shrink-0",
                        plan.highlighted ? "text-secondary" : "text-success"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        plan.highlighted
                          ? "text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "secondary" : "default"}
                className="w-full"
                asChild
              >
                <Link to={plan.price === "Custom" ? "/support" : "/login"}>
                  {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ Preview */}
        <div className="mt-20 text-center">
          <p className="text-muted-foreground">
            Have questions about our pricing?{" "}
            <Link to="/support" className="text-secondary hover:underline">
              Contact our team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
