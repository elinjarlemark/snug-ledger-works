import { useState } from "react";
import {
  Receipt as ReceiptIcon,
  Trash2,
  Link2,
  Image,
  FileText,
  ExternalLink,
  Search,
  Check,
  ChevronsUpDown,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useReceipts, type Receipt } from "@/contexts/ReceiptsContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

export default function ReceiptsPage() {
  const { user } = useAuth();
  const { receipts, removeReceipt, linkReceipt } = useReceipts();
  const { vouchers } = useAccounting();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [relinkDialog, setRelinkDialog] = useState<string | null>(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [voucherPickerOpen, setVoucherPickerOpen] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // Utkast ligger normalt separat från vouchers, men kontrollera även
  // status och nummer ifall en sådan post skulle förekomma i listan.
  const postedVouchers = vouchers.filter(
    (voucher) => voucher.status !== "DRAFT" && voucher.voucherNumber > 0
  );

  const filteredReceipts = receipts.filter((receipt) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      receipt.name.toLowerCase().includes(query) ||
      (receipt.voucherNumber !== null &&
        String(receipt.voucherNumber).includes(query))
    );
  });

  const deleteCandidate = receipts.find((receipt) => receipt.id === deleteConfirm);
  const receiptToLink = receipts.find((receipt) => receipt.id === relinkDialog);
  const selectedVoucher = postedVouchers.find((voucher) => voucher.id === selectedVoucherId);

  const closeLinkDialog = () => {
    setRelinkDialog(null);
    setSelectedVoucherId("");
    setVoucherPickerOpen(false);
  };

  const handleDelete = () => {
    if (!deleteCandidate) {
      setDeleteConfirm(null);
      return;
    }

    if (deleteCandidate.voucherId) {
      toast.error("Ett underlag till en bokförd verifikation kan inte raderas.");
      setDeleteConfirm(null);
      return;
    }

    const removed = removeReceipt(deleteCandidate.id);
    setDeleteConfirm(null);

    if (removed) {
      toast.success("Kvittot har raderats.");
    }
    // ReceiptsContext visar själv ett felmeddelande om raderingen nekas.
  };

  const handleLink = () => {
    if (!receiptToLink || !selectedVoucher) return;

    if (receiptToLink.voucherId) {
      toast.error("Underlaget är redan kopplat och kan inte flyttas.");
      closeLinkDialog();
      return;
    }

    const linked = linkReceipt(
      receiptToLink.id,
      selectedVoucher.id,
      selectedVoucher.voucherNumber
    );

    if (linked) {
      toast.success(
        "Underlaget har kopplats till verifikation #" + selectedVoucher.voucherNumber + "."
      );
      closeLinkDialog();
    }
    // ReceiptsContext visar själv ett felmeddelande om kopplingen nekas.
  };

  const handlePreview = (receipt: Receipt) => {
    if (!receipt.dataUrl) {
      toast.error("Underlaget saknar filinnehåll och kan inte visas.");
      return;
    }

    const supportedDataUrl =
      /^data:image\/[a-z0-9.+-]+;base64,/i.test(receipt.dataUrl) ||
      /^data:application\/pdf;base64,/i.test(receipt.dataUrl);

    if (!supportedDataUrl) {
      toast.error("Filformatet kan inte förhandsvisas här.");
      return;
    }

    setPreviewReceipt(receipt);
  };

  if (!user) {
    return (
      <div className="space-y-12 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <ReceiptIcon className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kvitton</h1>
            <p className="text-muted-foreground">Hantera uppladdade underlag.</p>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <Lock className="h-6 w-6 text-primary shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Logga in för att se kvitton
              </h3>
              <p className="text-muted-foreground mb-4">
                Du måste vara inloggad för att hantera företagets underlag.
              </p>
              <Button asChild><Link to="/login">Logga in</Link></Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold gradient-text">Kvitton</h1>
        <p className="text-sm text-muted-foreground">
          Hantera fristående kvitton och visa underlag till bokförda verifikationer.
          Kopplade original bevaras och kan inte raderas eller flyttas.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-foreground">
          Alla kvitton ({filteredReceipts.length})
        </h2>
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Sök kvitto eller verifikationsnummer..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Inga kvitton hittades.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredReceipts.map((receipt) => {
            const isLinked = Boolean(receipt.voucherId);
            return (
              <Card key={receipt.id}>
                <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {receipt.type.startsWith("image/") ? (
                      <Image className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm break-words">{receipt.name}</p>
                      {isLinked ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Kopplat till verifikation #{receipt.voucherNumber} · Skyddat underlag
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Fristående kvitto · Kan kopplas eller raderas
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(receipt)}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visa
                    </Button>
                    {!isLinked && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRelinkDialog(receipt.id);
                            setSelectedVoucherId("");
                            setVoucherPickerOpen(false);
                          }}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Koppla
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          aria-label={"Radera " + receipt.name}
                          onClick={() => setDeleteConfirm(receipt.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera fristående kvitto?</AlertDialogTitle>
            <AlertDialogDescription>
              Kvittot tas bort permanent. Kvitton som redan är kopplade till en
              bokförd verifikation kan inte raderas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteCandidate || Boolean(deleteCandidate.voucherId)}
              onClick={handleDelete}
            >
              Radera kvitto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(relinkDialog)}
        onOpenChange={(open) => {
          if (!open) closeLinkDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koppla kvitto till verifikation</DialogTitle>
            <DialogDescription>
              När underlaget har kopplats till en bokförd verifikation blir
              kopplingen permanent. Välj därför rätt verifikation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Popover open={voucherPickerOpen} onOpenChange={setVoucherPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={voucherPickerOpen}
                  className="w-full justify-between"
                >
                  {selectedVoucher
                    ? "#" + selectedVoucher.voucherNumber + " — " + selectedVoucher.description
                    : "Välj en bokförd verifikation..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Sök nummer eller beskrivning..." />
                  <CommandList>
                    <CommandEmpty>Ingen bokförd verifikation hittades.</CommandEmpty>
                    <CommandGroup>
                      {postedVouchers.map((voucher) => (
                        <CommandItem
                          key={voucher.id}
                          value={String(voucher.voucherNumber) + " " + voucher.description}
                          onSelect={() => {
                            setSelectedVoucherId(voucher.id);
                            setVoucherPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVoucherId === voucher.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          #{voucher.voucherNumber} — {voucher.description}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeLinkDialog}>Avbryt</Button>
              <Button
                disabled={!selectedVoucher || !receiptToLink || Boolean(receiptToLink.voucherId)}
                onClick={handleLink}
              >
                Koppla permanent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewReceipt !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewReceipt(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewReceipt?.name || "Visa underlag"}</DialogTitle>
            <DialogDescription>
              Originalunderlaget visas utan att ändras.
            </DialogDescription>
          </DialogHeader>
          {previewReceipt &&
            /^data:application\/pdf;base64,/i.test(previewReceipt.dataUrl) && (
              <iframe
                title={previewReceipt.name}
                src={previewReceipt.dataUrl}
                className="w-full h-[70vh] border-0 rounded-md"
              />
            )}
          {previewReceipt &&
            /^data:image\/[a-z0-9.+-]+;base64,/i.test(previewReceipt.dataUrl) && (
              <img
                src={previewReceipt.dataUrl}
                alt={previewReceipt.name}
                className="max-w-full max-h-[70vh] mx-auto object-contain"
              />
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
