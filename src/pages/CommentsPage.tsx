import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VoucherDetailsDialog } from "@/components/accounting/VoucherDetailsDialog";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useComments } from "@/contexts/CommentsContext";

export default function CommentsPage() {
  const { user, activeCompany, isLoading } = useAuth();
  const { comments, deleteComment } = useComments();
  const { getVoucherById } = useAccounting();
  const navigate = useNavigate();
  const [openVoucher, setOpenVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  return (
    <div className="space-y-4">
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Kommentarer</h1>
                <p className="text-sm text-muted-foreground">
                  {activeCompany
                    ? `Kommentarer för ${activeCompany.companyName || "valt bolag"}`
                    : "Välj ett bolag för att se kommentarer"}
                </p>
              </div>
            </div>
          </div>

          {!activeCompany ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Välj ett bolag i Settings för att se kommentarer.
            </div>
          ) : comments.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Inga kommentarer ännu. Lägg till en kommentar inne på en verifikation.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {comments.map((comment) => {
                const linkedVoucher = comment.targetType === "voucher" ? getVoucherById(comment.targetId) : undefined;
                return (
                  <div key={comment.id} className="p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{comment.targetLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString()}
                          {comment.createdBy ? ` · ${comment.createdBy}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {linkedVoucher && (
                          <Button variant="outline" size="sm" onClick={() => setOpenVoucher(linkedVoucher)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Öppna verifikation
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteComment(comment.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Ta bort
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{comment.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <VoucherDetailsDialog voucher={openVoucher} open={Boolean(openVoucher)} onOpenChange={(open) => !open && setOpenVoucher(null)} />
    </div>
  );
}
