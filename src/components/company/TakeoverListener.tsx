// src/components/company/TakeoverListener.tsx
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

type TakeoverRequestRow = {
  id: number;
  requestedBy?: { id: number; email?: string | null; name?: string | null };
  expiresAt?: string; // ISO
};

type TakeoverListResponse = {
  value?: TakeoverRequestRow[];
  Count?: number;
} | TakeoverRequestRow[];

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

function pickFirstRequest(payload: TakeoverListResponse): TakeoverRequestRow | null {
  if (Array.isArray(payload)) {
    return payload.length ? payload[0] : null;
  }
  const arr = (payload && (payload as any).value) ? ((payload as any).value as TakeoverRequestRow[]) : [];
  return arr.length ? arr[0] : null;
}

export function TakeoverListener(props: {
  companyId: number | string;
  userId: number;
  pollMs?: number; // default 2000
  enabled?: boolean; // default true
  onApproved?: () => void;
}) {
  const companyId = props.companyId;
  const userId = props.userId;
  const pollMs = typeof props.pollMs === "number" ? props.pollMs : 2000;
  const enabled = props.enabled !== false;

  const [open, setOpen] = useState(false);
  const [req, setReq] = useState<TakeoverRequestRow | null>(null);
  const [busy, setBusy] = useState(false);

  // Prevent spamming toasts / reopening same request constantly
  const lastSeenRequestIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function fetchTakeoverRequests() {
    if (!enabled) return;

    try {
      const url = API_BASE_URL + "/companies/" + companyId + "/takeover-requests";
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return;

      const data = (await res.json()) as TakeoverListResponse;
      const first = pickFirstRequest(data);

      if (!first) {
        // if popup is open but request disappeared (expired), close it
        if (open && req) {
          setOpen(false);
          setReq(null);
          toast.info("Takeover request gick ut.");
        }
        return;
      }

      // If we already show this exact request, do nothing
      if (req && req.id === first.id) return;

      // Only open if it's a new request we haven't shown yet
      if (lastSeenRequestIdRef.current !== first.id) {
        lastSeenRequestIdRef.current = first.id;
        setReq(first);
        setOpen(true);

        const who =
          (first.requestedBy && (first.requestedBy.name || first.requestedBy.email)) ||
          "En användare";
        toast.info(who + " vill ta över låset för bolaget.");
      }
    } catch {
      // ignore polling errors
    }
  }

  useEffect(() => {
    if (!enabled || !companyId) return;

    // initial fetch + interval
    fetchTakeoverRequests();
    const t = setInterval(fetchTakeoverRequests, pollMs);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, companyId, pollMs]);

  async function approve() {
    if (!req) return;
    setBusy(true);
    try {
      const url = API_BASE_URL + "/companies/takeover/" + req.id + "/approve";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        toast.error("Kunde inte godkänna takeover. " + (txt || ""));
        return;
      }

      toast.success("Takeover godkänd. Låset flyttades.");
      setOpen(false);
      setReq(null);

      if (props.onApproved) props.onApproved();
    } catch {
      toast.error("Kunde inte godkänna takeover.");
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  }

  async function reject() {
    if (!req) return;
    setBusy(true);
    try {
      const url = API_BASE_URL + "/companies/takeover/" + req.id + "/reject";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        toast.error("Kunde inte neka takeover. " + (txt || ""));
        return;
      }

      toast.success("Takeover nekad.");
      setOpen(false);
      setReq(null);
    } catch {
      toast.error("Kunde inte neka takeover.");
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  }

  const who =
    (req && req.requestedBy && (req.requestedBy.name || req.requestedBy.email)) ||
    "En användare";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Takeover request</AlertDialogTitle>
          <AlertDialogDescription>
            {who + " vill ta över låset för detta bolag."}
            <br />
            {"Om du godkänner flyttas låset till den användaren direkt."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={reject}>
            Neka
          </AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={approve}>
            Godkänn
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}