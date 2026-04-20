import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/bas-accounts";
import { BoxResult } from "@/lib/vat/report";
import { REPORT_BOX_GROUPS, getReportBox } from "@/lib/vat/reportBoxes";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  results: BoxResult[];
}

export function MomsRapportTable({ results }: Props) {
  const [openBox, setOpenBox] = useState<BoxResult | null>(null);

  const grouped = REPORT_BOX_GROUPS.map((g) => ({
    ...g,
    rows: results.filter((r) => getReportBox(r.box)?.group === g.id),
  }));

  return (
    <>
      <div className="space-y-4">
        {grouped.map((g) => (
          <Card key={g.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{g.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ruta</TableHead>
                    <TableHead>Beskrivning</TableHead>
                    <TableHead className="text-right w-40">Belopp (SEK)</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => {
                    const empty = Math.abs(r.amount) < 0.01;
                    return (
                      <TableRow
                        key={r.box}
                        className={cn(empty && "opacity-60")}
                      >
                        <TableCell className="font-mono font-semibold">{r.box}</TableCell>
                        <TableCell className="text-sm">{r.label}</TableCell>
                        <TableCell className="text-right font-mono">
                          {empty ? <span className="text-muted-foreground">—</span> : formatAmount(r.amount)}
                        </TableCell>
                        <TableCell>
                          {!empty && r.sources.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpenBox(r)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openBox} onOpenChange={(o) => !o && setOpenBox(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Ruta {openBox?.box} — {openBox?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Totalt belopp</span>
              <span className="font-mono font-semibold">{openBox ? formatAmount(openBox.amount) : ""}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Källa</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openBox?.sources.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{s.date}</TableCell>
                    <TableCell className="text-xs">{s.label}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatAmount(s.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
