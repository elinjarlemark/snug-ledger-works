import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  onConfirm: () => void;
}

export function LasPeriodDialog({ open, onOpenChange, periodLabel, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lås momsperiod {periodLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            När perioden är låst blockeras nya verifikationer och fakturaändringar i perioden. Du måste använda en rättelseverifikation eller kreditfaktura om något behöver ändras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Lås perioden</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
