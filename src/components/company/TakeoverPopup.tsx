import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000"

interface Props {
  companyId: number | string
  userId: number
}

interface TakeoverRequest {
  id: number
  requestedBy: {
    id: number
    email: string
    name: string
  }
  expiresAt: string
}

export function TakeoverPopup({ companyId, userId }: Props) {
  const [requests, setRequests] = useState<TakeoverRequest[]>([])
  const [loading, setLoading] = useState(false)

  const loadRequests = async () => {
    try {
      const res = await fetch(
        API_BASE_URL + "/companies/" + companyId + "/takeover-requests"
			)
      if (!res.ok) return

      const data = await res.json()
      setRequests(data.value ?? [])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadRequests()
    const i = setInterval(loadRequests, 2000)
    return () => clearInterval(i)
  }, [companyId])

  const approve = async (id: number) => {
    setLoading(true)

    try {
      const res = await fetch(
        API_BASE_URL + "/companies/takeover/" + id + "/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
          }),
        }
      )

      if (!res.ok) {
        toast.error("Failed to approve takeover")
        return
      }

      toast.success("Takeover approved")
      loadRequests()
    } catch {
      toast.error("Error approving takeover")
    } finally {
      setLoading(false)
    }
  }

  const reject = async (id: number) => {
    setLoading(true)

    try {
      const res = await fetch(
        API_BASE_URL + "/companies/takeover/" + id + "/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
          }),
        }
      )

      if (!res.ok) {
        toast.error("Failed to reject takeover")
        return
      }

      toast.info("Takeover rejected")
      loadRequests()
    } catch {
      toast.error("Error rejecting takeover")
    } finally {
      setLoading(false)
    }
  }

  if (!requests.length) return null

  return (
    <Card className="border-red-400">
      <CardHeader>
        <CardTitle>Takeover request</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-4"
          >
            <div>
              <div className="font-medium">{r.requestedBy.name}</div>
              <div className="text-sm text-muted-foreground">
                {r.requestedBy.email} wants to take over the company
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={loading}
                onClick={() => approve(r.id)}
              >
                Approve
              </Button>

              <Button
                size="sm"
                variant="destructive"
                disabled={loading}
                onClick={() => reject(r.id)}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}