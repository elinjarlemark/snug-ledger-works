import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { decideJoinRequest, listJoinRequests } from '@/lib/api';

type JoinRequestItem = {
  id: number;
  companyId: number;
  requestedBy: { id: number; email?: string | null; name?: string | null };
  status: string;
  createdAt?: string | null;
};

export function JoinRequestsPanel(props: { companyId: string; userId: string }) {
  const { companyId, userId } = props;

  const [items, setItems] = useState<JoinRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      const data = await listJoinRequests(companyId, userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kunde inte hämta join requests';
      // Om user inte är admin/owner får du 403 här — det är OK, vi visar bara inget då.
      // Men vi toastar inte det varje gång om du vill: just nu toastar vi.
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId]);

  async function decide(id: number, action: 'approve' | 'reject') {
    setDecidingId(id);
    try {
      await decideJoinRequest(id, userId, action);
      toast.success(action === 'approve' ? 'Godkänd' : 'Nekad');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kunde inte uppdatera request';
      toast.error(msg);
    } finally {
      setDecidingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className='rounded-lg border p-4'>
        <div className='text-sm text-muted-foreground'>Laddar join requests...</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className='rounded-lg border p-4'>
        <div className='font-medium text-foreground'>Join requests</div>
        <div className='text-sm text-muted-foreground mt-1'>Inga väntande requests.</div>
      </div>
    );
  }

  return (
    <div className='rounded-lg border p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='font-medium text-foreground'>Join requests</div>
        <Button variant='outline' size='sm' onClick={refresh}>
          Uppdatera
        </Button>
      </div>

      <div className='space-y-2'>
        {items.map((r) => {
          const who = r.requestedBy?.name || r.requestedBy?.email || ('User ' + r.requestedBy?.id);
          const disabled = decidingId === r.id;

          return (
            <div key={r.id} className='flex items-center justify-between gap-3 rounded-md border p-3'>
              <div className='min-w-0'>
                <div className='font-medium text-foreground truncate'>{who}</div>
                <div className='text-xs text-muted-foreground'>
                  Status: {r.status}
                  {r.createdAt ? ' • ' + r.createdAt : ''}
                </div>
              </div>

              <div className='flex gap-2'>
                <Button
                  size='sm'
                  disabled={disabled}
                  onClick={() => decide(r.id, 'approve')}
                >
                  {disabled ? 'Jobbar...' : 'Approve'}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={disabled}
                  onClick={() => decide(r.id, 'reject')}
                >
                  {disabled ? 'Jobbar...' : 'Reject'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}