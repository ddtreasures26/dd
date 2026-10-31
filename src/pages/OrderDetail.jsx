import { Link, useNavigate, useParams } from 'react-router-dom';
import { Store, money } from '../store';
import { useAuth } from '../auth';
import { Icon, Timeline, toast, waLink } from '../ui';
import { orderText } from './Pay';
import { reorder } from './Orders';

export function OrderSummary({ o }) {
  return (
    <section className="card">
      <h2>Order summary</h2>
      {o.items.map((i, k) => {
        const p = Store.product(i.id);
        return (
          <div className="line flat" key={k}>
            <img src={p?.images[0] || Store.data.settings.logo} alt="" />
            <div className="grow"><b>{i.name}</b><div className="muted small">{money(i.price)} × {i.qty}</div></div>
            <b>{money(i.price * i.qty)}</b>
          </div>
        );
      })}
      <dl className="totals">
        <div><dt>Items</dt><dd>{money(o.subtotal)}</dd></div>
        {o.mode === 'courier' && <div><dt>Courier ({o.courierZone})</dt><dd>{money(o.courierCharge)}</dd></div>}
        <div className="grand"><dt>Total</dt><dd>{money(o.total)}</dd></div>
      </dl>
      {o.mode === 'courier' && <p className="muted small">Courier charge is an estimate and will be confirmed with you on WhatsApp.</p>}
    </section>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { enabled, user } = useAuth();
  const nav = useNavigate();
  const o = Store.orders().find(x => x.id === id);
  const s = Store.data.settings;

  if (enabled && !user) return <div className="empty"><p>Sign in to view this order.</p><Link className="btn" to={`/login?next=/order/${id}`}>Sign in</Link></div>;
  if (!o || (o.userEmail || '') !== (user?.email || '')) return <div className="empty">Order not found. <Link to="/orders">My orders</Link></div>;

  const c = o.customer;
  const cancel = () => {
    if (!confirm('Cancel this order?')) return;
    Store.setOrders(Store.orders().map(x => x.id === o.id ? { ...x, status: 'Cancelled' } : x));
    toast('Order cancelled');
  };

  return (
    <div className="detail-page">
      <Link to="/orders" className="muted small">← My orders</Link>
      <div className="row between">
        <h1>{o.id}</h1>
        <span className={`pill ${o.status.replace(/\s/g, '').toLowerCase()}`}>{o.status}</span>
      </div>
      <small className="muted">Placed {new Date(o.date).toLocaleString()}</small>

      <section className="card"><Timeline status={o.status} /></section>
      <OrderSummary o={o} />

      <section className="card">
        <h2>{o.mode === 'courier' ? 'Delivery address' : 'Pickup / hand over'}</h2>
        <p style={{ margin: 0 }}>
          <b>{c.name}</b><br />{c.phone}
          {o.mode === 'courier' && <><br />{c.address}<br />{c.city} – {c.pin}</>}
          {c.note && <><br /><span className="muted">Note: {c.note}</span></>}
        </p>
      </section>

      <div className="actions-bar">
        {o.status === 'Awaiting payment' && <Link className="btn" to={`/pay/${o.id}`}>Pay {money(o.total)}</Link>}
        <a className="btn wa" href={waLink(s.whatsapp, orderText(o, o.status !== 'Awaiting payment'))} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> WhatsApp us</a>
        <button className="btn ghost" onClick={() => reorder(o, nav)}>Reorder</button>
        {o.status === 'Awaiting payment' && <button className="btn ghost danger" onClick={cancel}>Cancel order</button>}
      </div>
    </div>
  );
}
