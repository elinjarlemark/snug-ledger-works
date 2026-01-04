import { Mail, MessageCircle, FileQuestion, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const supportOptions = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Send us an email and we'll respond within 24 hours.",
    action: "support@accountpro.se",
    actionType: "email",
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    description: "Chat with our support team during business hours.",
    action: "Start Chat",
    actionType: "button",
  },
  {
    icon: FileQuestion,
    title: "FAQ",
    description: "Find answers to commonly asked questions.",
    action: "View FAQ",
    actionType: "button",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Learn how to use AccountPro with detailed guides.",
    action: "Read Docs",
    actionType: "button",
  },
];

const faqs = [
  {
    question: "How do I get started with AccountPro?",
    answer:
      "Simply create an account, set up your company profile with your organization details, and you're ready to start bookkeeping. Our system comes pre-configured with the Swedish BAS chart of accounts.",
  },
  {
    question: "Is AccountPro compliant with Swedish regulations?",
    answer:
      "Yes, AccountPro is built specifically for Swedish businesses and follows Swedish bookkeeping law (Bokföringslagen), the BAS chart of accounts, and supports all required tax declarations.",
  },
  {
    question: "Can I import data from another accounting system?",
    answer:
      "Yes, we support importing opening balances and historical data. Contact our support team for assistance with migration from your current system.",
  },
  {
    question: "How secure is my data?",
    answer:
      "Your data is encrypted both in transit and at rest. We use industry-standard security practices and regular backups to ensure your financial data is always protected.",
  },
];

export default function SupportPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            How Can We Help?
          </h1>
          <p className="text-lg text-muted-foreground">
            Our support team is here to help you get the most out of AccountPro.
          </p>
        </div>

        {/* Support Options */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {supportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div key={option.title} className="feature-card text-center">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {option.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {option.description}
                </p>
                {option.actionType === "email" ? (
                  <a
                    href={`mailto:${option.action}`}
                    className="text-secondary hover:underline text-sm font-medium"
                  >
                    {option.action}
                  </a>
                ) : (
                  <Button variant="outline" size="sm">
                    {option.action}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-6 border border-border"
              >
                <h3 className="font-semibold text-foreground mb-2">
                  {faq.question}
                </h3>
                <p className="text-muted-foreground text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-16 text-center bg-muted/30 rounded-xl p-8">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Still Have Questions?
          </h3>
          <p className="text-muted-foreground mb-4">
            Our team is ready to help with any questions about AccountPro.
          </p>
          <Button asChild>
            <a href="mailto:support@accountpro.se">Contact Support</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
