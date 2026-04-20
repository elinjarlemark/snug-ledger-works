import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/bas-accounts";
import { useAccounting } from "@/contexts/AccountingContext";
import { BoxResult } from "@/lib/vat/report";
import { cn } from "@/lib/utils";

interface Props {
  results: BoxResult[];
  startDate: string;
  endDate: string;
}

export function MomsAvstamning({ results, startDate, endDate }: Props) {
  const { vouchers } = useAccounting();

  const bookKeeping = useMemo(() => {
    let sales = 0;
    let outputVat = 0;
    let purchases = 0;
    let inputVat = 0;
    vouchers
      .filter((v) => v.date >= startDate && v.date <= endDate)
      .forEach((v) => {
        v.lines.forEach((l) => {
          const acc = parseInt(l.accountNumber, 10);
          if (acc >= 3000 && acc <= 3999) sales += (l.credit || 0) - (l.debit || 0);
          if (acc >= 2610 && acc <= 2619) outputVat += (l.credit || 0) - (l.debit || 0);
          if (acc >= 4000 && acc <= 7999) purchases += (l.debit || 0) - (l.credit || 0);
          if (acc >= 2640 && acc <= 2649) inputVat += (l.debit || 0) - (l.credit || 0);
        });
      });
    return { sales, outputVat, purchases, inputVat };
  }, [vouchers, startDate, endDate]);

  const sumBoxes = (nums: string[]) => results.filter((r) => nums.includes(r.box)).reduce((s, r) => s + r.amount, 0);
  const reportSales = sumBoxes(["05", "06", "07"]);
  const reportOutputVat = sumBoxes(["10", "11", "12"]);
  const reportInputVat = sumBoxes(["48"]);

  const rows = [
    { label: "Försäljning (konto 3xxx)", book: bookKeeping.sales, report: reportSales, reportLabel: "Ruta 05+06+07" },
    { label: "Utgående moms (konto 2610–2619)", book: bookKeeping.outputVat, report: reportOutputVat, reportLabel: "Ruta 10+11+12" },
    { label: "Ingående moms (konto 2640–2649)", book: bookKeeping.inputVat, report: reportInputVat, reportLabel: "Ruta 48" },
  ];

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Momsavstämning</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Område</TableHead>
              <TableHead className="text-right">I bokföringen</TableHead>
              <TableHead className="text-right">I momsrapporten</TableHead>
              <TableHead className="text-right">Differens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const diff = r.book - r.report;
              const ok = Math.abs(diff) < 1;
              return (
                <TableRow key={r.label}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatAmount(r.book)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatAmount(r.report)}
                    <div className="text-[10px] text-muted-foreground">{r.reportLabel}</div>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-sm", ok ? "text-success" : "text-destructive")}>
                    {ok ? "OK" : formatAmount(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-3">
          Differens visar skillnaden mellan saldon i bokföringen och beloppen som hamnar i momsrapportens rutor. En differens kan bero på saknade momskoder, felbokade transaktioner eller poster i fel period.
        </p>
      </CardContent>
    </Card>
  );
}
