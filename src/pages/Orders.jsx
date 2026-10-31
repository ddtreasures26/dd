import { Link, useNavigate } from 'react-router-dom';
import { Store, money } from '../store';
import { useAuth } from '../auth';
import { Timeline, toast, Img } from '../ui';
import { useOrderSync } from '../sync';
import { REMOTE } from '../api';

export const reorder = (o, nav) => {
  let n = 0;
  o.items.forEach(i => { if (Store.addToCart(i.id, i.qty)) n++; });
  toast(n ? 'Items added to your cart' : 'Those items are unavailable now');
  if (n) nav('/cart');
};

export const mineOnly = user => Store.orders().filter(o => (o.userEmail || '') === (user?.email || ''));

export default function Orders() {
  const { enabled, user } = useAuth();
  const nav = useNavigate();
  useOrderSync();
  if (enabled && !user) return <div className="empty"><p>Sign in to see your orders.</p><Link className="btn" to="/login?next=/orders">Sign in</Link></div>;
  const orders = mineOnly(user);
  if (!orders.length) return <div className="empty"><p>No orders yet.</p><Link className="btn" to="/">Shop now</Link></div>;

  return (
    <div className="orders">
      <h1>My orders</h1>
      <p className="muted small">{REMOTE ? 'Your order status updates here automatically.' : 'Saved on this device for now; they will follow your Google account once cloud sync is on.'}</p>
      {orders.map(o => (
        <article className="card order" key={o.id}>
          <div className="row between">
            <b>{o.id}</b>
            <span className={`pill ${o.status.replace(/\s/g, '').toLowerCase()}`}>{o.status}</span>
          </div>
          <small className="muted">{new Date(o.date).toLocaleString()} · {o.items.reduce((a, i) => a + i.qty, 0)} item(s)</small>
          <div className="mini">
            {o.items.slice(0, 5).map((i, k) => <Img key={k} src={Store.product(i.id)?.images[0] || Store.data.settings.logo} w={120} alt={i.name} title={i.name} />)}
            {o.items.length > 5 && <span className="more">+{o.items.length - 5}</span>}
          </div>
          <Timeline status={o.status} />
          <div className="row between">
            <b className="amt">{money(o.total)}</b>
            <div className="row">
              {o.status === 'Awaiting payment' && <Link className="btn small" to={`/pay/${o.id}`}>Pay now</Link>}
              <Link className="btn small ghost" to={`/order/${o.id}`}>Details</Link>
              <button className="btn small ghost" onClick={() => reorder(o, nav)}>Reorder</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
