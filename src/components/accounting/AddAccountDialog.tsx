import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounting } from "@/contexts/AccountingContext";
import { getAccountClass, getAccountClassName, isValidAccountNumber } from "@/lib/bas-accounts";
import { toast } from "sonner";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const { accounts, addAccount } = useAccounting();
  
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!isValidAccountNumber(accountNumber)) {
      toast.error("Account number must be exactly 4 digits");
      return;
    }
    
    if (accounts.find(a => a.number === accountNumber)) {
      toast.error("An account with this number already exists");
      return;
    }
    
    if (!accountName.trim()) {
      toast.error("Account name is required");
      return;
    }

    const accountClass = getAccountClass(accountNumber);
    
    addAccount({
      number: accountNumber,
      name: accountName.trim(),
      class: accountClass,
      description: description.trim() || undefined,
    });

    toast.success(`Account ${accountNumber} - ${accountName} added successfully`);
    onOpenChange(false);
    setAccountNumber("");
    setAccountName("");
    setDescription("");
  };

  const previewClass = accountNumber.length >= 1 
    ? getAccountClassName(getAccountClass(accountNumber))
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="e.g., 1920"
              className="font-mono"
            />
            {previewClass && (
              <p className="text-sm text-muted-foreground">
                Class: <span className="text-secondary font-medium">{previewClass}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., Bankgiro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the account"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Add Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
