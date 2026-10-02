import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Voucher, useAccounting } from "@/contexts/AccountingContext";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useComments } from "@/contexts/CommentsContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { formatAmount } from "@/lib/bas-accounts";
import {
  X, RotateCcw, FileText, Image, ExternalLink, Copy,
  Upload, Eye, MessageSquare, Lock, Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoucherDetailsProps {
  voucher: Voucher;
  onClose: () => void;
  onEdit?: () => void; // Behålls för äldre anrop, men bokförda poster kan inte redigeras.
  onDuplicate?: (voucher: Voucher) => void;
}

function localDate(): string {
  const date = new Date();
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayTimestamp(value?: string): string {
  if (!value) return "Ej registrerat";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("sv-SE");
}

function openAttachment(dataUrl: string, type: string): void {
  if (!dataUrl) {
    toast.error("Underlaget saknar filinnehåll.");
    return;
  }
  const preview = window.open("", "_blank");
  if (!preview) {
    toast.error("Webbläsaren blockerade förhandsvisningen.");
    return;
  }
  preview.opener = null;
  preview.document.title = "Verifikationsunderlag";
  preview.document.body.style.margin = "0";
  const element = preview.document.createElement(
    type === "application/pdf" ? "iframe" : "img"
  );
  element.setAttribute("src", dataUrl);
  element.setAttribute("alt", "Verifikationsunderlag");
  element.style.display = "block";
  element.style.width = "100%";
  element.style.minHeight = type === "application/pdf" ? "100vh" : "auto";
  element.style.border = "0";
  preview.document.body.appendChild(element);
}

export function VoucherDetails({
  voucher,
  onClose,
  onDuplicate,
}: VoucherDetailsProps) {
  const { vouchers } = useAccounting();
  const { addEntry } = useAuditTrail();
  const { addComment, getCommentsForTarget } = useComments();
  const { isYearLocked } = useFiscalLock();
  const { addReceipt, getReceiptsForVoucher } = useReceipts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReceiptsDialog, setShowReceiptsDialog] = useState(false);
  const [commentText, setCommentText] = useState("");

  // En rättelse görs i en öppen period. Originalets år kan redan vara låst.
  const correctionDate = localDate();
  const correctionYearLocked = isYearLocked(Number(correctionDate.slice(0, 4)));
  const actualReversal = vouchers.find((entry) =>
    entry.reversesVoucherId === voucher.id
  );
  const alreadyReversed = Boolean(voucher.reversedByVoucherId || actualReversal);
  const mayStartReversal = Boolean(onDuplicate) && !correctionYearLocked && !alreadyReversed;

  const linkedReceipts = getReceiptsForVoucher(voucher.id);
  const originalAttachments = voucher.attachments || [];
  const totalAttachments = linkedReceipts.length + originalAttachments.length;
  const voucherComments = getCommentsForTarget("voucher", voucher.id);
  const totalDebit = voucher.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = voucher.lines.reduce((sum, line) => sum + line.credit, 0);

  const handleReversal = () => {
    if (!mayStartReversal || !onDuplicate) {
      toast.error(alreadyReversed
        ? "Verifikationen har redan en vändning."
        : "Det finns ingen öppen period för en vändning.");
      return;
    }

    const draft: Voucher = {
      ...voucher,
      id: crypto.randomUUID(),
      voucherNumber: 0,
      status: "DRAFT",
      date: correctionDate,
      documentDate: correctionDate,
      description: "Vändning av verifikation #" + voucher.voucherNumber + ": " + voucher.description,
      party: voucher.party,
      lines: voucher.lines.map((line) => ({
        ...line,
        id: crypto.randomUUID(),
        debit: line.credit,
        credit: line.debit,
      })),
      // Originalunderlagen hör till originalet, inte till det nya utkastet.
      attachments: [],
      reversesVoucherId: voucher.id,
      reversesVoucherNumber: voucher.voucherNumber,
      reversedByVoucherId: undefined,
      reversedByVoucherNumber: undefined,
      postedAt: undefined,
      postedByUserId: undefined,
      postedByName: undefined,
      originalSeries: undefined,
      originalVoucherNumber: undefined,
      importSourceId: undefined,
      importedAt: undefined,
      createdAt: new Date().toISOString(),
    };

    onDuplicate(draft);
    addEntry("Påbörjade vändningsutkast för verifikation #" + voucher.voucherNumber);
    toast.info("Kontrollera vändningen innan du bokför den.");
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Endast bilder och PDF-filer stöds: " + file.name);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => toast.error("Det gick inte att läsa " + file.name);
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          toast.error("Det gick inte att läsa " + file.name);
          return;
        }
        const newReceipt = addReceipt({
          name: file.name,
          type: file.type,
          dataUrl: reader.result,
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
        });
        addEntry(
          "Kompletterade verifikation #" + voucher.voucherNumber +
          " med underlaget " + file.name + " (ID: " + newReceipt.id + ")"
        );
        toast.success("Kompletterande underlag tillagt.");
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const comment = addComment({
      targetType: "voucher",
      targetId: voucher.id,
      targetLabel: "Verifikation #" + voucher.voucherNumber + " · " + voucher.description,
      text,
    });
    if (comment) {
      setCommentText("");
      toast.success("Kommentar sparad.");
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Verifikation #{voucher.voucherNumber}
          </h2>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Bokförd – originaluppgifterna är låsta
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Stäng">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {(voucher.reversesVoucherNumber || voucher.reversedByVoucherNumber || actualReversal) && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <Link2 className="h-4 w-4" /> Kopplade verifikationer
          </div>
          {voucher.reversesVoucherNumber && (
            <p>Den här verifikationen vänder verifikation #{voucher.reversesVoucherNumber}.</p>
          )}
          {(voucher.reversedByVoucherNumber || actualReversal) && (
            <p>Den här verifikationen har vänts av verifikation #{voucher.reversedByVoucherNumber || actualReversal?.voucherNumber}.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2">
        <div><p className="text-muted-foreground">Affärsdatum</p><p className="font-medium">{voucher.date}</p></div>
        <div><p className="text-muted-foreground">Verifikationsdatum</p><p className="font-medium">{voucher.documentDate || voucher.date}</p></div>
        <div><p className="text-muted-foreground">Beskrivning</p><p className="font-medium whitespace-pre-wrap">{voucher.description}</p></div>
        <div><p className="text-muted-foreground">Motpart</p><p className="font-medium">{voucher.party || "Inte angiven"}</p></div>
        <div><p className="text-muted-foreground">Bokförd av</p><p className="font-medium">{voucher.postedByName || "Ej registrerat"}</p></div>
        <div><p className="text-muted-foreground">Registreringstidpunkt</p><p className="font-medium">{displayTimestamp(voucher.postedAt || voucher.createdAt)}</p></div>
        {voucher.originalSeries && (
          <div>
            <p className="text-muted-foreground">Ursprungligt verifikationsnummer</p>
            <p className="font-medium">{voucher.originalSeries}{voucher.originalVoucherNumber ?? ""}</p>
          </div>
        )}
        {voucher.importSourceId && (
          <div><p className="text-muted-foreground">SIE-importens ID</p><p className="font-mono text-xs break-all">{voucher.importSourceId}</p></div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-3 text-left font-medium">Konto</th>
              <th className="p-3 text-left font-medium">Kontonamn</th>
              <th className="p-3 text-right font-medium">Debet</th>
              <th className="p-3 text-right font-medium">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="p-3 font-mono">{line.accountNumber}</td>
                <td className="p-3 text-muted-foreground">{line.accountName}</td>
                <td className="p-3 text-right font-mono">{line.debit > 0 ? formatAmount(line.debit) : ""}</td>
                <td className="p-3 text-right font-mono">{line.credit > 0 ? formatAmount(line.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 font-semibold">
              <td className="p-3" colSpan={2}>Summa</td>
              <td className="p-3 text-right font-mono">{formatAmount(totalDebit)}</td>
              <td className="p-3 text-right font-mono">{formatAmount(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Underlag ({totalAttachments})</h3>
          <div className="flex gap-2">
            {totalAttachments > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowReceiptsDialog(true)}>
                <Eye className="mr-2 h-4 w-4" /> Visa
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Komplettera
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Originalunderlag bevaras. Nya filer läggs till som kompletteringar och kan inte kopplas loss från verifikationen.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Kommentarer ({voucherComments.length})</h3>
        </div>
        <Textarea
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="Skriv en kompletterande kommentar..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!commentText.trim()} onClick={handleAddComment}>
            Lägg till kommentar
          </Button>
        </div>
        {voucherComments.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {voucherComments.map((comment) => (
              <div key={comment.id} className="rounded-md bg-muted/30 p-3 text-sm">
                <p className="whitespace-pre-wrap">{comment.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {displayTimestamp(comment.createdAt)}
                  {comment.createdBy ? " · " + comment.createdBy : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onDuplicate && (
          <Button variant="outline" onClick={() => onDuplicate(voucher)}>
            <Copy className="mr-2 h-4 w-4" /> Kopiera som ny
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleReversal}
          disabled={!mayStartReversal}
          title={alreadyReversed
            ? "Verifikationen har redan vänts"
            : correctionYearLocked
              ? "Det aktuella året är låst"
              : undefined}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Skapa vändning
        </Button>
      </div>

      <Dialog open={showReceiptsDialog} onOpenChange={setShowReceiptsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Underlag för verifikation #{voucher.voucherNumber}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {originalAttachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {attachment.type.startsWith("image/")
                    ? <Image className="h-4 w-4 shrink-0" />
                    : <FileText className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{attachment.name} (original)</span>
                </span>
                <Button size="icon" variant="ghost" aria-label="Visa originalunderlag"
                  onClick={() => openAttachment(attachment.dataUrl, attachment.type)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {linkedReceipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {receipt.type.startsWith("image/")
                    ? <Image className="h-4 w-4 shrink-0" />
                    : <FileText className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{receipt.name}</span>
                </span>
                <Button size="icon" variant="ghost" aria-label="Visa underlag"
                  onClick={() => openAttachment(receipt.dataUrl, receipt.type)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {totalAttachments === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Inga underlag har kopplats.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
