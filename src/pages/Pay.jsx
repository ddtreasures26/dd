import { Link, useParams } from 'react-router-dom';
import { Store, money } from '../store';
import { Icon, toast, waLink, Img } from '../ui';
import { REMOTE, api } from '../api';
import { useAuth } from '../auth';
import { useOrderSync } from '../sync';
import { OrderSummary } from './OrderDetail';

export const orderText = (o, paid) => {
  const c = o.customer;
  return [
    `Hi DD_Treasure26! ${paid ? 'I have paid for' : 'Please confirm'} my order.`,
    `Order ID: ${o.id}`,
    ...o.items.map(i => `• ${i.name}${i.variant ? ` (${i.variant})` : ''} × ${i.qty} = ${money(i.price * i.qty)}`),
    `Items: ${money(o.subtotal)}`,
    ...(o.discount > 0 ? [`Coupon ${o.coupon?.code}: −${money(o.discount)}`] : []),
    o.mode === 'courier' ? `Courier (${o.courierZone}): ${money(o.courierCharge)} – to be confirmed` : 'Delivery: pickup / hand over',
    ...(o.giftWrap ? [`Gift wrap: ${money(o.giftFee)}${o.giftMessage ? ` — message: "${o.giftMessage}"` : ''}`] : []),
    `Total: ${money(o.total)}`,
    `Name: ${c.name}`, `Phone: ${c.phone}`,
    ...(o.mode === 'courier' ? [`Address: ${c.address}, ${c.city} - ${c.pin}`] : []),
    ...(c.note ? [`Note: ${c.note}`] : []),
    paid ? 'I am attaching the payment screenshot.' : ''
  ].filter(Boolean).join('\n');
};

const copy = async (text, what) => {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Copy not supported'); }
};

export default function Pay() {
  const { id } = useParams();
  const { getToken } = useAuth();
  useOrderSync();
  const o = Store.orders().find(x => x.id === id);
  const s = Store.data.settings;
  if (!o) return <div className="empty">Order not found. <Link to="/orders">My orders</Link></div>;

  // Personal UPI IDs are often refused ("limit exceeded") when a link pre-fills the amount, so that is opt-in (Admin > Shop details).
  const upi = s.upiId
    ? `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.shopName)}&cu=INR` +
      (s.upiPrefill ? `&am=${Number(o.total).toFixed(2)}&tn=${encodeURIComponent(o.id)}` : '')
    : '';
  const paid = o.status !== 'Awaiting payment';

  const sent = async () => {
    if (o.status !== 'Awaiting payment') return;
    Store.setOrders(Store.orders().map(x => x.id === o.id ? { ...x, status: 'Payment sent' } : x));
    if (REMOTE) { try { await api.markPaymentSent(await getToken(), o.id); } catch { /* the WhatsApp message still reaches the shop */ } }
  };

  return (
    <div className="pay-page">
      <ol className="flow">
        <li className="done"><span>1</span>Cart</li>
        <li className="done"><span>2</span>Details</li>
        <li className={paid ? 'done' : 'now'}><span>3</span>Pay</li>
        <li className={paid ? 'now' : ''}><span>4</span>Confirm</li>
      </ol>

      <section className="card pay">
        <p className="muted">Order placed 🎉</p>
        <h1>{o.id}</h1>
        <div className="amount">{money(o.total)}</div>
        {o.mode === 'courier' && <p className="muted small">Includes estimated courier of {money(o.courierCharge)}. The final amount is confirmed on WhatsApp.</p>}

        {s.qrImage
          ? <Img className="qr" src={s.qrImage} w={700} alt="Payment QR code" />
          : <p className="notice">The shop hasn’t added a payment QR yet.</p>}

        <div className="row center">
          <button className="btn ghost small" onClick={() => copy(String(o.total), 'Amount')}><Icon name="copy" size={16} /> Copy amount</button>
          {s.upiId && <button className="btn ghost small" onClick={() => copy(s.upiId, 'UPI ID')}><Icon name="copy" size={16} /> {s.upiId}</button>}
          {upi && <a className="btn small" href={upi}>Open UPI app</a>}
        </div>
        {upi && !s.upiPrefill && <p className="muted small" style={{ margin: 0 }}>Type <b>{money(o.total)}</b> as the amount in your UPI app, and add <b>{o.id}</b> as the note.</p>}

        <ol className="steps">
          <li>Pay <b>{money(o.total)}</b> with GPay or any UPI app.</li>
          <li>Take a screenshot of the payment.</li>
          <li>Send the order details and screenshot on WhatsApp to confirm.</li>
        </ol>

        <a className="btn wa block-btn" href={waLink(s.whatsapp, orderText(o, true))} target="_blank" rel="noreferrer" onClick={sent}>
          <Icon name="chat" size={20} /> Send order &amp; payment on WhatsApp
        </a>
        <p className="muted small">Status: <b>{o.status}</b> · <Link to={`/order/${o.id}`}>Order details</Link> · <Link to="/orders">My orders</Link></p>
      </section>

      <OrderSummary o={o} />
    </div>
  );
}
