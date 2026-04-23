import { useState, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Receipt, Upload, LogOut, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { toast } from "sonner";

export default function MobileUpload() {
  const { user, activeCompany, logout } = useAuth();
  const { addReceipt, receipts } = useReceipts();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);

  if (!user) {
    return <Navigate to="/mobile" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/mobile", { replace: true });
  };

  const handleFile = async (file: File) => {
    if (!activeCompany) {
      toast.error("Ingen aktiv företag - kan inte spara kvitto");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        addReceipt({
          name: file.name,
          type: file.type,
          dataUrl,
          voucherId: null,
          voucherNumber: null,
        });
        setLastUploaded(file.name);
        toast.success("Kvitto uppladdat!");
        setUploading(false);
        setTimeout(() => setLastUploaded(null), 4000);
      };
      reader.onerror = () => {
        toast.error("Kunde inte läsa filen");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Något gick fel");
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const userReceiptsCount = receipts.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-foreground">
            Account<span className="text-secondary">Pro</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="gap-1"
        >
          <LogOut className="h-4 w-4" />
          Logga ut
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-secondary/10 items-center justify-center mb-2">
            <Receipt className="h-8 w-8 text-secondary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Ladda upp kvitto</h1>
          <p className="text-sm text-muted-foreground">
            Vill du ladda upp ett kvitto?
          </p>
          {activeCompany && (
            <p className="text-xs text-muted-foreground pt-1">
              {activeCompany.companyName}
            </p>
          )}
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Button
            size="xl"
            className="w-full h-16 text-base"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Camera className="mr-2 h-5 w-5" />
            )}
            Ta bild med kamera
          </Button>

          <Button
            variant="outline"
            size="xl"
            className="w-full h-16 text-base"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-5 w-5" />
            Välj fil
          </Button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {lastUploaded && (
          <div className="w-full max-w-sm flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20 animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Sparat!</p>
              <p className="text-xs text-muted-foreground truncate">{lastUploaded}</p>
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Totalt uppladdade kvitton: <span className="font-semibold text-foreground">{userReceiptsCount}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
