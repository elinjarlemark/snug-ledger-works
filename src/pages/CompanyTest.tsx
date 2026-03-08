import { useEffect, useState } from "react";
import { listCompanies, login } from "../lib/api";
import { useCompanySession } from "../hooks/useCompanySession";

export default function CompanyTest() {
  const [email, setEmail] = useState("test1@example.com");
  const [password, setPassword] = useState("Test1234!");
  const [user, setUser] = useState<any>(null);

  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);

  const session = useCompanySession(companyId, user?.id ?? null);

  async function doLogin() {
    const res = await login(email, password);
    if (!res.success) {
      alert(res.error || "Login failed");
      return;
    }
    setUser(res.user);
  }

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      const cs = await listCompanies(user.id);
      setCompanies(cs);
      if (cs.length > 0) setCompanyId(cs[0].id);
    }
    load();
  }, [user?.id]);

  return (
    <div style={{ padding: 16, maxWidth: 800 }}>
      <h2>Company session test</h2>

      {!user ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
          />
          <button onClick={doLogin}>Login</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            Logged in as <b>{user.email}</b> (id {user.id})
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Company: </label>
            <select
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(Number(e.target.value))}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.organizationNumber})
                </option>
              ))}
            </select>
          </div>

          {session.loading && <div>Loading / locking…</div>}

          {session.lockDenied && (
            <div style={{ padding: 12, border: "1px solid #f00", marginBottom: 12 }}>
              <b>Företaget är låst</b>
              <div>
                Låst av: {session.lockDenied.lockedBy.name} ({session.lockDenied.lockedBy.email})
              </div>
              <div>Går ut: {session.lockDenied.expiresAt}</div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            Lock status: <b>{session.locked ? "LOCKED ✅" : "NOT LOCKED ❌"}</b>
          </div>

          <div style={{ marginBottom: 8 }}>
            SIE version: <b>{session.sieVersion ?? "null"}</b>
          </div>

          <textarea
            style={{ width: "100%", height: 240 }}
            value={session.sieContent}
            onChange={(e) => session.saveSie(e.target.value)}
            placeholder="SIE content..."
          />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            (Den här uppdaterar servern direkt vid ändring just för test. Sen gör vi riktig “Spara”-knapp.)
          </div>
        </>
      )}
    </div>
  );
}