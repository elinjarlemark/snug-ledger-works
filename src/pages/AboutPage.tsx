import { Target, Users, Shield, Sparkles } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Simplicity",
    description:
      "We believe accounting software should be intuitive and easy to use, not a source of frustration.",
  },
  {
    icon: Shield,
    title: "Compliance",
    description:
      "Built from the ground up for Swedish regulations, ensuring your books are always audit-ready.",
  },
  {
    icon: Users,
    title: "Support",
    description:
      "Our team of accounting experts is always ready to help you succeed with your bookkeeping.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description:
      "We continuously improve our platform with new features that make accounting even easier.",
  },
];

export default function AboutPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="container">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-6">
            About AccountPro
          </h1>
          <p className="text-lg text-muted-foreground">
            We're on a mission to make professional accounting accessible to every Swedish business, from solo entrepreneurs to growing companies.
          </p>
        </div>

        {/* Story Section */}
        <section className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-foreground mb-6">Our Story</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              AccountPro was founded with a simple observation: small and medium-sized Swedish businesses deserve accounting software that truly understands their needs. Too many companies struggle with complex systems designed for large enterprises or imported solutions that don't properly support Swedish regulations.
            </p>
            <p>
              We set out to build something different – a modern, web-based accounting platform that combines regulatory correctness with an intuitive user experience. Every feature is designed with Swedish BAS compliance built in, so you can focus on running your business instead of worrying about bookkeeping rules.
            </p>
            <p>
              Today, AccountPro serves businesses across Sweden, from freelancers and consultants to growing companies with multiple employees. Our platform handles everything from daily vouchers to annual reports, always ensuring your books are balanced and compliant.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            Our Values
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div key={value.title} className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-muted/30 rounded-xl p-8 lg:p-12 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Get in Touch
          </h2>
          <p className="text-muted-foreground mb-2">
            Have questions about AccountPro? We'd love to hear from you.
          </p>
          <p className="text-secondary font-medium">info@accountpro.se</p>
        </section>
      </div>
    </div>
  );
}
