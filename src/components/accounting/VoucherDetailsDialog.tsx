import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Voucher, useAccounting } from "@/contexts/AccountingContext";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useComments } from "@/contexts/CommentsContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { formatAmount } from "@/lib/bas-accounts";
import {
  ExternalLink,
  FileText,
  Image,
  Link2,
  Lock,
  MessageSquare,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { VoucherForm } from "./VoucherForm";

interface VoucherDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucher: Voucher | null;
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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("sv-SE");
}

function voucherSeries(value?: string): string {
  const normalized = (value || "A").trim().toUpperCase();
  return /^[A-Z][A-Z0-9]{0,9}$/.test(normalized) ? normalized : "A";
}

function voucherReference(
  value: Pick<Voucher, "voucherNumber" | "series">
): string {
  return `${voucherSeries(value.series)}${value.voucherNumber}`;
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Det gick inte att läsa " + file.name));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Det gick inte att läsa " + file.name));
        return;
      }
      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

export function VoucherDetailsDialog({
  open,
  onOpenChange,
  voucher,
}: VoucherDetailsDialogProps) {
  const { vouchers } = useAccounting();
  const { addEntry } = useAuditTrail();
  const { addComment, getCommentsForTarget } = useComments();
  const { isYearLocked } = useFiscalLock();
  const { addReceipt, getReceiptsForVoucher } = useReceipts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reversalDraft, setReversalDraft] = useState<Voucher | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  useEffect(() => {
    setReversalDraft(null);
    setCommentText("");
  }, [open, voucher?.id]);

  if (!voucher) return null;

  // Använd den uppdaterade verifikationen från kontexten om den finns.
  // Då visas en ny koppling till en rättelse även om dialogen redan är öppen.
  const currentVoucher = vouchers.find((entry) => entry.id === voucher.id) || voucher;
  const voucherRef = voucherReference(currentVoucher);
  const reversalSource = currentVoucher.reversesVoucherId
    ? vouchers.find((entry) => entry.id === currentVoucher.reversesVoucherId)
    : undefined;
  const correctionDate = localDate();
  const correctionYearLocked = isYearLocked(Number(correctionDate.slice(0, 4)));
  const actualReversal = vouchers.find(
    (entry) => entry.reversesVoucherId === currentVoucher.id
  );
  const reversalSourceRef = currentVoucher.reversesVoucherNumber
    ? reversalSource
      ? voucherReference(reversalSource)
      : `${voucherSeries(currentVoucher.series)}${currentVoucher.reversesVoucherNumber}`
    : undefined;
  const reversedByRef = currentVoucher.reversedByVoucherNumber || actualReversal
    ? actualReversal
      ? voucherReference(actualReversal)
      : `${voucherSeries(currentVoucher.series)}${currentVoucher.reversedByVoucherNumber}`
    : undefined;
  const alreadyReversed = Boolean(
    currentVoucher.reversedByVoucherId || actualReversal
  );
  const mayStartReversal = !correctionYearLocked && !alreadyReversed && currentVoucher.status !== "DRAFT";
  const linkedReceipts = getReceiptsForVoucher(currentVoucher.id);
  const originalAttachments = currentVoucher.attachments || [];
  const voucherComments = getCommentsForTarget("voucher", currentVoucher.id);
  const totalDebit = currentVoucher.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = currentVoucher.lines.reduce((sum, line) => sum + line.credit, 0);

  const closeDialog = () => {
    setReversalDraft(null);
    onOpenChange(false);
  };

  const handleReversal = () => {
    if (!mayStartReversal) {
      toast.error(
        alreadyReversed
          ? "Verifikationen har redan en vändning."
          : "Det går inte att skapa en vändning i en stängd period."
      );
      return;
    }

    const draft: Voucher = {
      ...currentVoucher,
      id: crypto.randomUUID(),
      voucherNumber: 0,
      status: "DRAFT",
      date: correctionDate,
      documentDate: correctionDate,
      description: "Vändning av verifikation " + voucherRef + ": " + currentVoucher.description,
      lines: currentVoucher.lines.map((line) => ({
        ...line,
        id: crypto.randomUUID(),
        debit: line.credit,
        credit: line.debit,
      })),
      // Underlag från originalet tillhör inte rättelseutkastet.
      attachments: [],
      reversesVoucherId: currentVoucher.id,
      reversesVoucherNumber: currentVoucher.voucherNumber,
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
    setReversalDraft(draft);
    addEntry("Påbörjade vändningsutkast för verifikation " + voucherRef);
    toast.info("Kontrollera vändningen innan du bokför den.");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0 || isUploadingAttachments) return;

    setIsUploadingAttachments(true);

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
          toast.error("Endast bilder och PDF-filer stöds: " + file.name);
          continue;
        }

        try {
          const dataUrl = await readFileAsDataUrl(file);
          const receipt = await addReceipt({
            name: file.name,
            type: file.type,
            dataUrl,
            voucherId: currentVoucher.id,
            voucherNumber: currentVoucher.voucherNumber,
            voucherSeries: currentVoucher.series || "A",
          });

          addEntry(
            "Kompletterade verifikation " + voucherRef +
            " med underlaget " + file.name + " (ID: " + receipt.id + ")"
          );
          toast.success("Kompletterande underlag tillagt.");
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Det gick inte att spara " + file.name + ".";
          toast.error(message);
        }
      }
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleAddComment = () => {
    const comment = commentText.trim();
    if (!comment) return;
    const added = addComment({
      targetType: "voucher",
      targetId: currentVoucher.id,
      targetLabel: "Verifikation " + voucherRef + " · " + currentVoucher.description,
      text: comment,
    });
    if (added) {
      setCommentText("");
      toast.success("Kommentar sparad.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setReversalDraft(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reversalDraft
              ? "Vändning av verifikation " + voucherRef
              : "Verifikation " + voucherRef}
          </DialogTitle>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Originalverifikationen är bokförd och låst
          </p>
        </DialogHeader>

        {reversalDraft ? (
          <VoucherForm
            duplicateFrom={reversalDraft}
            templateName={"Vändning av verifikation " + voucherRef}
            onSuccess={closeDialog}
            onCancel={() => setReversalDraft(null)}
          />
        ) : (
          <div className="space-y-6">
            {(reversalSourceRef || reversedByRef) && (
              <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Link2 className="h-4 w-4" /> Kopplade verifikationer
                </p>
                {reversalSourceRef && (
                  <p>Den här verifikationen vänder verifikation {reversalSourceRef}.</p>
                )}
                {reversedByRef && (
                  <p>Den här verifikationen har vänts av verifikation {reversedByRef}.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <div><p className="text-muted-foreground">Affärsdatum</p><p className="font-medium">{currentVoucher.date}</p></div>
              <div><p className="text-muted-foreground">Verifikationsdatum</p><p className="font-medium">{currentVoucher.documentDate || currentVoucher.date}</p></div>
              <div><p className="text-muted-foreground">Beskrivning</p><p className="font-medium whitespace-pre-wrap">{currentVoucher.description}</p></div>
              <div><p className="text-muted-foreground">Motpart</p><p className="font-medium">{currentVoucher.party || "Inte angiven"}</p></div>
              <div><p className="text-muted-foreground">Bokförd av</p><p className="font-medium">{currentVoucher.postedByName || "Ej registrerat"}</p></div>
              <div><p className="text-muted-foreground">Registreringstidpunkt</p><p className="font-medium">{displayTimestamp(currentVoucher.postedAt || currentVoucher.createdAt)}</p></div>
              {currentVoucher.originalVoucherNumber !== undefined && (
                <div><p className="text-muted-foreground">Ursprunglig SIE-verifikation</p>
                  <p className="font-medium">{currentVoucher.originalSeries || "A"}{currentVoucher.originalVoucherNumber}</p>
                </div>
              )}
              {currentVoucher.importSourceId && (
                <div><p className="text-muted-foreground">Importreferens</p><p className="break-all font-mono text-xs">{currentVoucher.importSourceId}</p></div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Underlag ({originalAttachments.length + linkedReceipts.length})</h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUploadingAttachments}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploadingAttachments ? "Sparar..." : "Lägg till komplettering"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  disabled={isUploadingAttachments}
                  onChange={handleFileChange}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {originalAttachments.map((attachment) => (
                  <Button
                    key={"original-" + attachment.id}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openAttachment(attachment.dataUrl, attachment.type)}
                  >
                    {attachment.type.startsWith("image/") ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    <span className="max-w-36 truncate">{attachment.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
                {linkedReceipts.map((receipt) => (
                  <Button
                    key={"receipt-" + receipt.id}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openAttachment(receipt.dataUrl, receipt.type)}
                  >
                    {receipt.type.startsWith("image/") ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    <span className="max-w-36 truncate">{receipt.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
                {originalAttachments.length + linkedReceipts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Inga underlag finns bifogade.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Originalunderlag kan inte tas bort här. Nya filer sparas som kompletteringar.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Konto</th>
                    <th className="p-3 text-left font-medium">Namn</th>
                    <th className="p-3 text-right font-medium">Debet</th>
                    <th className="p-3 text-right font-medium">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {currentVoucher.lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="p-3 font-mono">{line.accountNumber}</td>
                      <td className="p-3 text-muted-foreground">{line.accountName}</td>
                      <td className="p-3 text-right font-mono">{line.debit > 0 ? formatAmount(line.debit) : ""}</td>
                      <td className="p-3 text-right font-mono">{line.credit > 0 ? formatAmount(line.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/30 font-semibold">
                  <tr>
                    <td className="p-3" colSpan={2}>Summa</td>
                    <td className="p-3 text-right font-mono">{formatAmount(totalDebit)}</td>
                    <td className="p-3 text-right font-mono">{formatAmount(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4" /> Kommentarer ({voucherComments.length})
              </h3>
              <Textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Lägg till en kommentar om verifikationen..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!commentText.trim()} onClick={handleAddComment}>
                  Lägg till kommentar
                </Button>
              </div>
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Stäng</Button>
              <Button variant="outline" onClick={handleReversal} disabled={!mayStartReversal}>
                <RotateCcw className="mr-2 h-4 w-4" /> Skapa vändning
              </Button>
            </div>
            {alreadyReversed && <p className="text-right text-xs text-muted-foreground">Verifikationen har redan vänts.</p>}
            {correctionYearLocked && <p className="text-right text-xs text-muted-foreground">Det aktuella året är stängt. Vändningen kan inte bokföras här.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
