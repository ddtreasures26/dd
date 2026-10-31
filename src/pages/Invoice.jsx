import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { REMOTE } from '../api';
import { Store, money } from '../store';
import { useOrderSync } from '../sync';
import { toast, Img } from '../ui';

const PAID = ['Confirmed', 'Shipped', 'Delivered'];

export default function Invoice() {
  const { id } = useParams();
  const { enabled, user, isAdmin } = useAuth();
  useOrderSync();
  useEffect(() => {
    if (REMOTE && isAdmin && !Store.adminOrders.length) Store.loadAdminData().catch(e => toast(e.message));
  }, [isAdmin]);

  const o = Store.orders().find(x => x.id === id) || (isAdmin && Store.adminOrders.find(x => x.id === id));
  if (enabled && !user) return <div className="empty"><p>Sign in to view this invoice.</p><Link className="btn" to={`/login?next=/invoice/${id}`}>Sign in</Link></div>;
  if (!o || (!isAdmin && (o.userEmail || '') !== (user?.email || ''))) return <div className="empty">Invoice not found. <Link to="/orders">My orders</Link></div>;

  const s = Store.data.settings;
  const c = o.customer;
  const paid = PAID.includes(o.status);

  return (
    <div className="invoice-wrap">
      <div className="row noprint">
        <Link to={`/order/${o.id}`} className="muted small">← Order</Link>
        <button className="btn small" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <article className="invoice card">
        <header className="inv-head">
          <Img src={s.logo} w={160} alt="" />
          <div className="grow">
            <h1>{s.shopName}</h1>
            <p className="muted small">{s.address}<br />{s.phone}{s.email && <> · {s.email}</>}</p>
          </div>
          <div className="inv-meta">
            <h2>INVOICE</h2>
            <b>{o.id}</b>
            <small className="muted">{new Date(o.date).toLocaleDateString()}</small>
            <span className={`pill ${paid ? 'confirmed' : ''}`}>{paid ? 'Paid' : o.status === 'Cancelled' ? 'Cancelled' : 'Payment pending'}</span>
          </div>
        </header>

        <section className="inv-bill">
          <b>Billed to</b>
          <p>{c.name}<br />{c.phone}{o.userEmail && <><br />{o.userEmail}</>}
            {o.mode === 'courier' && <><br />{c.address}<br />{c.city} – {c.pin}</>}</p>
          <p className="muted small">{o.mode === 'courier' ? `Courier – ${o.courierZone}` : 'Pickup / hand over'}</p>
        </section>

        <table className="inv-table">
          <thead><tr><th>Item</th><th className="r">Price</th><th className="r">Qty</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {o.items.map((i, k) => (
              <tr key={k}><td>{i.name}{i.variant && <small className="muted"><br />{i.variant}</small>}</td><td className="r">{money(i.price)}</td><td className="r">{i.qty}</td><td className="r">{money(i.price * i.qty)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan="3" className="r">Items</td><td className="r">{money(o.subtotal)}</td></tr>
            {o.discount > 0 && <tr><td colSpan="3" className="r">Coupon {o.coupon?.code}</td><td className="r">−{money(o.discount)}</td></tr>}
            {o.mode === 'courier' && <tr><td colSpan="3" className="r">Courier ({o.courierZone})</td><td className="r">{money(o.courierCharge)}</td></tr>}
            {o.giftFee > 0 && <tr><td colSpan="3" className="r">Gift wrap</td><td className="r">{money(o.giftFee)}</td></tr>}
            <tr className="grand"><td colSpan="3" className="r">Total</td><td className="r">{money(o.total)}</td></tr>
          </tfoot>
        </table>

        {o.giftWrap && o.giftMessage && <p className="muted small">Gift message: “{o.giftMessage}”</p>}
        <p className="inv-foot">Thank you for shopping with {s.shopName} — handmade with love 💗</p>
      </article>
    </div>
  );
}
