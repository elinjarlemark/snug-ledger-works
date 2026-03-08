import { useEffect, useRef, useState } from "react";
import {
  lockCompany,
  lockHeartbeat,
  unlockCompany,
  getSieState,
  putSieState,
} from "../lib/api";

type LockedBy = { id: number; email?: string; name?: string };

export function useCompanySession(companyId: number | null, userId: number | null) {
  const [locked, setLocked] = useState<boolean>(false);
  const [lockDenied, setLockDenied] = useState<null | { lockedBy: LockedBy; expiresAt: string }>(
    null
  );
  const [sieContent, setSieContent] = useState<string>("");
  const [sieVersion, setSieVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const hbTimer = useRef<number | null>(null);

  function storageKey() {
    return companyId ? `sie_cache_company_${companyId}` : "";
  }

  // Acquire lock + load SIE
  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!companyId || !userId) return;

      setLoading(true);
      setLockDenied(null);

      // load local cache first (fast UI)
      const key = storageKey();
      const cached = key ? localStorage.getItem(key) : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (!cancelled && typeof parsed.sieContent === "string") {
            setSieContent(parsed.sieContent);
            setSieVersion(parsed.version ?? null);
          }
        } catch {}
      }

      try {
        const res: any = await lockCompany(companyId, userId);

        if (!cancelled) {
          if (res.success) {
            setLocked(true);
          } else {
            setLocked(false);
            if (res.lockedBy && res.expiresAt) {
              setLockDenied({ lockedBy: res.lockedBy, expiresAt: res.expiresAt });
            }
            setLoading(false);
            return;
          }
        }

        // start heartbeat every 30s
        if (hbTimer.current) window.clearInterval(hbTimer.current);
        hbTimer.current = window.setInterval(async () => {
          try {
            await lockHeartbeat(companyId, userId);
          } catch {
            // if heartbeat fails, we just stop it and mark unlocked
            setLocked(false);
            if (hbTimer.current) window.clearInterval(hbTimer.current);
            hbTimer.current = null;
          }
        }, 30000);

        // fetch latest SIE from server
        const sie: any = await getSieState(companyId, userId);
        if (cancelled) return;

        const serverSie = sie?.sieContent ?? "";
        const serverVer = sie?.version ?? null;

        setSieContent(serverSie);
        setSieVersion(serverVer);

        // update local cache
        localStorage.setItem(key, JSON.stringify({ sieContent: serverSie, version: serverVer }));

        setLoading(false);
      } catch (err: any) {
        // 409 might be lock-related, but lock endpoint returns 200 with success:false.
        // Still handle just in case.
        setLocked(false);
        setLoading(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      // cleanup heartbeat + unlock on company switch/unmount
      if (hbTimer.current) {
        window.clearInterval(hbTimer.current);
        hbTimer.current = null;
      }
      if (companyId && userId) {
        unlockCompany(companyId, userId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId]);

  async function saveSie(newContent: string) {
    if (!companyId || !userId) return;

    setSieContent(newContent);

    // update cache immediately
    localStorage.setItem(storageKey(), JSON.stringify({ sieContent: newContent, version: sieVersion }));

    try {
      const res: any = await putSieState(companyId, userId, newContent);
      setSieVersion(res.version ?? null);
      // refresh cache with new version
      localStorage.setItem(storageKey(), JSON.stringify({ sieContent: newContent, version: res.version ?? null }));
      return { ok: true };
    } catch (err: any) {
      // backend returns 409 with {detail:{message,lockedBy,expiresAt}}
      if (err?.status === 409 && err?.data?.detail?.lockedBy) {
        setLockDenied({
          lockedBy: err.data.detail.lockedBy,
          expiresAt: err.data.detail.expiresAt,
        });
      }
      return { ok: false, err };
    }
  }

  return {
    locked,
    lockDenied,
    sieContent,
    sieVersion,
    loading,
    saveSie,
  };
}