import { useEffect } from 'react';
import { REMOTE, api } from './api';
import { Store } from './store';
import { useAuth } from './auth';
import { notify, toast } from './ui';

/** Pull this customer's orders from the server; returns orders whose status or total changed. */
export async function refreshMyOrders(getToken, email) {
  if (!REMOTE || !email) return [];
  const { orders } = await api.myOrders(await getToken());
  const before = new Map(Store.orders().map(o => [o.id, o]));
  const changed = orders.filter(o => {
    const b = before.get(o.id);
    return b && (b.status !== o.status || b.total !== o.total);
  });
  Store.syncMyOrders(orders, email);
  return changed;
}

/** Keeps orders fresh and alerts the customer when one changes. poll=true also repeats every minute. */
export function useOrderSync({ poll = false } = {}) {
  const { user, getToken } = useAuth();
  useEffect(() => {
    if (!REMOTE || !user) return;
    let off = false;
    const run = async () => {
      if (document.hidden) return;
      try {
        const changed = await refreshMyOrders(getToken, user.email);
        if (off) return;
        changed.forEach(o => {
          toast(`Order ${o.id}: ${o.status}`);
          notify(`Order ${o.id}`, `Status: ${o.status}`);
        });
      } catch { /* offline or signed out */ }
    };
    run();
    if (!poll) return () => { off = true; };
    const t = setInterval(run, 60000);
    document.addEventListener('visibilitychange', run);
    return () => { off = true; clearInterval(t); document.removeEventListener('visibilitychange', run); };
  }, [user?.email]);
}
