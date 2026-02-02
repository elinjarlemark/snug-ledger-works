import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdminUser {
  id: number | string;
  email: string;
  name: string | null;
  role: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/users`);
        if (!response.ok) {
          throw new Error("Failed to load users");
        }
        const payload = await response.json();
        setUsers(payload);
      } catch (err) {
        setError("Unable to load users from the API.");
      }
    };

    loadUsers();
  }, [user, navigate]);

  const handleRoleChange = async (userId: number | string, role: string) => {
    try {
      setSaving(Number(userId));
      const response = await fetch(`${apiBaseUrl}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error("Failed to update role");
      }
      setUsers((prev) =>
        prev.map((account) =>
          account.id === userId ? { ...account, role } : account
        )
      );
    } catch (err) {
      setError("Unable to update user role.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">Manage accounts in the database</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <div className="space-y-3">
              {users.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{account.email}</div>
                    <div className="text-sm text-muted-foreground">{account.name ?? "-"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      value={account.role}
                      onValueChange={(value) => handleRoleChange(account.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {saving === Number(account.id) && (
                      <span className="text-xs text-muted-foreground">Saving...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate("/economy")}>Back to Economy</Button>
    </div>
  );
}
