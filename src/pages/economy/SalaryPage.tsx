import { useState } from "react";
import { Users, Plus, Trash2, Edit, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Employee {
  id: string;
  name: string;
  personalNumber: string;
  address: string;
  postalCode: string;
  city: string;
  salary: number;
  jobTitle: string;
  employmentType: "full-time" | "part-time" | "seasonal" | "hourly";
}

function EmployeeForm({
  onSubmit,
  onCancel,
  editEmployee,
}: {
  onSubmit: (employee: Omit<Employee, "id">) => void;
  onCancel: () => void;
  editEmployee?: Employee;
}) {
  const [name, setName] = useState(editEmployee?.name || "");
  const [personalNumber, setPersonalNumber] = useState(editEmployee?.personalNumber || "");
  const isHourly = employmentType === "hourly";
  const [address, setAddress] = useState(editEmployee?.address || "");
  const [postalCode, setPostalCode] = useState(editEmployee?.postalCode || "");
  const [city, setCity] = useState(editEmployee?.city || "");
  const [salary, setSalary] = useState(editEmployee?.salary?.toString() || "");
  const [jobTitle, setJobTitle] = useState(editEmployee?.jobTitle || "");
  const [employmentType, setEmploymentType] = useState<Employee["employmentType"]>(
    editEmployee?.employmentType || "full-time"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || /[0-9]/.test(name)) { toast.error("Valid name is required (no numbers)"); return; }
    if (!personalNumber.trim() || personalNumber.replace(/\D/g, "").length !== 12) {
      toast.error("Valid personal number (12 digits) is required"); return;
    }
    if (!address.trim()) { toast.error("Address is required"); return; }
    if (!postalCode.trim()) { toast.error("Postal code is required"); return; }
    if (!city.trim()) { toast.error("City is required"); return; }
    if (!salary || parseFloat(salary) <= 0) { toast.error("Valid salary is required"); return; }
    if (!jobTitle.trim()) { toast.error("Job title is required"); return; }

    onSubmit({
      name: name.trim(),
      personalNumber,
      address: address.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      salary: parseFloat(salary),
      jobTitle: jobTitle.trim(),
      employmentType,
    });
  };

  const handlePersonalNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    if (digits.length > 8) {
      setPersonalNumber(digits.slice(0, 8) + "-" + digits.slice(8));
    } else {
      setPersonalNumber(digits);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value.replace(/[0-9]/g, ""))} placeholder="Full name" className="h-9 text-sm" required />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Personal Number *</Label>
        <Input value={personalNumber} onChange={(e) => handlePersonalNumber(e.target.value)} placeholder="YYYYMMDD-XXXX" maxLength={13} className="h-9 text-sm" required />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Address *</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className="h-9 text-sm" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Postal Code *</Label>
          <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="123 45" className="h-9 text-sm" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City *</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stockholm" className="h-9 text-sm" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Job Title *</Label>
        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Software Developer" className="h-9 text-sm" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Monthly Salary (SEK) *</Label>
          <Input type="number" min="0" step="100" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="35000" className="h-9 text-sm" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Employment Type *</Label>
          <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as Employee["employmentType"])}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="seasonal">Seasonal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-3 pt-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" size="sm">Cancel</Button>
        <Button type="submit" className="flex-1" size="sm">{editEmployee ? "Save Changes" : "Add Employee"}</Button>
      </div>
    </form>
  );
}

const STORAGE_KEY = "accountpro_employees";

function getStoredEmployees(companyId: string): Employee[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data[companyId] || [];
  } catch { return []; }
}

function setStoredEmployees(companyId: string, employees: Employee[]) {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  data[companyId] = employees;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function SalaryPage() {
  const { user, activeCompany } = useAuth();
  const companyId = activeCompany?.id || "";
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees(companyId));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const saveEmployees = (updated: Employee[]) => {
    setEmployees(updated);
    setStoredEmployees(companyId, updated);
  };

  const handleAdd = (data: Omit<Employee, "id">) => {
    if (editingEmployee) {
      const updated = employees.map((e) => e.id === editingEmployee.id ? { ...e, ...data } : e);
      saveEmployees(updated);
      toast.success("Employee updated");
    } else {
      const newEmp: Employee = { ...data, id: crypto.randomUUID() };
      saveEmployees([...employees, newEmp]);
      toast.success("Employee added");
    }
    setDialogOpen(false);
    setEditingEmployee(undefined);
  };

  const handleDelete = (id: string) => {
    saveEmployees(employees.filter((e) => e.id !== id));
    setDeleteConfirm(null);
    toast.success("Employee deleted");
  };

  const employmentLabel = (t: string) => {
    switch (t) {
      case "full-time": return "Full-time";
      case "part-time": return "Part-time";
      case "seasonal": return "Seasonal";
      default: return t;
    }
  };

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Salary</h1>
            <p className="text-sm text-muted-foreground">Payroll processing and employee management</p>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">Process Payroll</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Sign in to manage employees and process payroll.
              </p>
              <Button size="sm" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Salary</h1>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditingEmployee(undefined); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Employee
        </Button>
      </div>

      {/* Employee List */}
      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No employees added yet. Click "Add Employee" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-foreground">Name</th>
                <th className="text-left py-2 px-3 font-medium text-foreground">Personal Number</th>
                <th className="text-left py-2 px-3 font-medium text-foreground">Job Title</th>
                <th className="text-left py-2 px-3 font-medium text-foreground">Type</th>
                <th className="text-right py-2 px-3 font-medium text-foreground">Salary</th>
                <th className="text-right py-2 px-3 font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border/50">
                  <td className="py-2 px-3">
                    <p className="font-medium text-foreground">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">{emp.address}, {emp.postalCode} {emp.city}</p>
                  </td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">{emp.personalNumber}</td>
                  <td className="py-2 px-3 text-foreground">{emp.jobTitle}</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary/10 text-secondary">
                      {employmentLabel(emp.employmentType)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">
                    {emp.salary.toLocaleString("sv-SE")} SEK
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingEmployee(emp); setDialogOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteConfirm(emp.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {employees.length > 0 && (
        <Card>
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-sm">Payroll Summary</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Employees</p>
                <p className="text-base font-bold text-foreground">{employees.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Payroll</p>
                <p className="text-base font-bold text-foreground">
                  {employees.reduce((s, e) => s + e.salary, 0).toLocaleString("sv-SE")} SEK
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Employer Cost (31.42%)</p>
                <p className="text-base font-bold text-foreground">
                  {Math.round(employees.reduce((s, e) => s + e.salary, 0) * 0.3142).toLocaleString("sv-SE")} SEK
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingEmployee(undefined); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            onSubmit={handleAdd}
            onCancel={() => { setDialogOpen(false); setEditingEmployee(undefined); }}
            editEmployee={editingEmployee}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete employee?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">This will permanently remove this employee.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
