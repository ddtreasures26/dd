import { Link, useParams } from 'react-router-dom';
import { Store, money } from '../store';
import { waLink } from '../ui';

export const orderText = (o, paid) => {
  const c = o.customer;
  return [
    `Hi DD_Treasure26! ${paid ? 'I have paid for' : 'Please confirm'} my order.`,
    `Order ID: ${o.id}`,
    ...o.items.map(i => `• ${i.name} × ${i.qty} = ${money(i.price * i.qty)}`),
    `Items: ${money(o.subtotal)}`,
    o.mode === 'courier' ? `Courier (${o.courierZone}): ${money(o.courierCharge)} – to be confirmed` : 'Delivery: pickup / hand over',
    `Total: ${money(o.total)}`,
    `Name: ${c.name}`, `Phone: ${c.phone}`,
    ...(o.mode === 'courier' ? [`Address: ${c.address}, ${c.city} - ${c.pin}`] : []),
    ...(c.note ? [`Note: ${c.note}`] : []),
    paid ? 'I am attaching the payment screenshot.' : ''
  ].filter(Boolean).join('\n');
};

export default function Pay() {
  const { id } = useParams();
  const o = Store.orders().find(x => x.id === id);
  const s = Store.data.settings;
  if (!o) return <div className="empty">Order not found. <Link to="/orders">My orders</Link></div>;

  const upi = s.upiId
    ? `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.shopName)}&am=${o.total}&cu=INR&tn=${encodeURIComponent(o.id)}`
    : '';

  const sent = () => {
    Store.setOrders(Store.orders().map(x => x.id === o.id ? { ...x, status: 'Payment sent' } : x));
  };

  return (
    <div className="pay card">
      <p className="muted">Order placed 🎉</p>
      <h1>{o.id}</h1>
      <div className="amount">{money(o.total)}</div>
      {o.mode === 'courier' && <p className="muted small">Includes estimated courier of {money(o.courierCharge)} – final amount confirmed on WhatsApp.</p>}

      <ol className="steps">
        <li>Pay <b>{money(o.total)}</b> using GPay / any UPI app{s.upiId && <> to <b>{s.upiId}</b></>}.</li>
        <li>Take a screenshot of the payment.</li>
        <li>Tap the button below and send the order details with the screenshot.</li>
      </ol>

      {s.qrImage
        ? <img className="qr" src={s.qrImage} alt="Payment QR code" />
        : <p className="notice">Admin hasn’t uploaded a payment QR yet (Admin → Settings).</p>}
      {upi && <a className="btn ghost" href={upi}>Open UPI app</a>}

      <a className="btn wa" href={waLink(s.whatsapp, orderText(o, true))} target="_blank" rel="noreferrer" onClick={sent}>
        💬 Send order &amp; payment details on WhatsApp
      </a>
      <p className="muted small">Status: <b>{o.status}</b> · Your order is saved in <Link to="/orders">My orders</Link> on this device.</p>
    </div>
  );
}
