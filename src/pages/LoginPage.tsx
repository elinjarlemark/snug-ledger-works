import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isReset) {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}/auth/reset`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: resetEmail,
              new_password: resetPassword,
            }),
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error ?? "Reset failed");
        }
        toast.success("Password reset successfully!");
        setIsReset(false);
        return;
      }
      if (isSignUp) {
        await signup(email, password, name);
        toast.success("Account created successfully!");
        // Redirect to company page for first-time setup
        navigate("/company");
      } else {
        await login(email, password);
        toast.success("Welcome back!");
        navigate("/economy");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
                <span className="text-primary-foreground font-bold text-xl">A</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                Account<span className="text-secondary">Pro</span>
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground">
              {isSignUp
                ? "Start managing your accounting today"
                : "Sign in to continue to your dashboard"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isReset && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email address</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="name@company.se"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resetPassword">New password</Label>
                  <Input
                    id="resetPassword"
                    type="password"
                    placeholder="Enter a new password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    className="pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignUp}
                  />
                </div>
              </div>
            )}
            
            {!isReset && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.se"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      className="pl-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {!isSignUp && !isReset && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-secondary hover:underline"
                  onClick={() => setIsReset(true)}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading
                ? "Please wait..."
                : isReset
                  ? "Reset Password"
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              {isReset
                ? "Back to sign in?"
                : isSignUp
                  ? "Already have an account?"
                  : "Don't have an account?"}{" "}
              <button
                onClick={() => {
                  if (isReset) {
                    setIsReset(false);
                    return;
                  }
                  setIsSignUp(!isSignUp);
                }}
                className="text-secondary hover:underline font-medium"
              >
                {isReset ? "Sign in" : isSignUp ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-bold mb-6">
            Professional Accounting for Swedish Businesses
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-secondary text-sm">✓</span>
              </div>
              <span>Full Swedish BAS compliance out of the box</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-secondary text-sm">✓</span>
              </div>
              <span>Double-entry bookkeeping with real-time validation</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-secondary text-sm">✓</span>
              </div>
              <span>Complete financial reporting and year-end closing</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
