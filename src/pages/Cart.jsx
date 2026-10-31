import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { REMOTE, api } from '../api';
import { Store, money } from '../store';
import { notify, toast } from '../ui';

export default function Cart() {
  const nav = useNavigate();
  const { enabled, user, getToken } = useAuth();
  const { courier } = Store.data.settings;
  const lines = Store.cart()
    .map(l => ({ ...l, p: Store.product(l.id) }))
    .filter(l => l.p && l.p.qty > 0)
    .map(l => ({ ...l, qty: Math.min(l.qty, l.p.qty) }));

  const [mode, setMode] = useState('pickup');
  const [zone, setZone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [f, setF] = useState(() => ({ name: user?.name || '', note: '', ...Store.profile(user?.email) }));
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const sync = next => Store.setCart(next.map(({ id, qty }) => ({ id, qty })));
  const change = (id, d) => sync(lines.map(l => l.id === id ? { ...l, qty: Math.max(1, Math.min(l.p.qty, l.qty + d)) } : l));
  const remove = id => sync(lines.filter(l => l.id !== id));

  const subtotal = lines.reduce((a, l) => a + Store.price(l.p) * l.qty, 0);
  const z = courier[zone];
  const shipping = mode === 'courier' && z ? Number(z.charge) : 0;
  const giftFee = gift ? Number(Store.data.settings.giftWrapFee) || 0 : 0;
  const total = subtotal + shipping + giftFee;

  if (!lines.length) {
    return <div className="empty"><p>Your cart is empty 🛍️</p><Link className="btn" to="/">Start shopping</Link></div>;
  }

  const place = async e => {
    e.preventDefault();
    if (busy) return;
    if (!/^\+?[\d\s-]{10,15}$/.test(f.phone)) return toast('Enter a valid phone number');
    const customer = { name: f.name, phone: f.phone, address: f.address, city: f.city, pin: f.pin, note: f.note };
    const courierZone = mode === 'courier' ? z?.name : '';
    let order;
    if (REMOTE) {
      setBusy(true);
      try {
        order = (await api.placeOrder(await getToken(), {
          items: lines.map(l => ({ id: l.id, qty: l.qty })), mode, courierZone,
          giftWrap: gift, giftMessage: gift ? giftMsg : '', customer
        })).order;
      } catch (err) {
        toast(err.message); Store.refresh(); setBusy(false);
        if (err.code === 'auth') nav('/login?next=/cart');
        return;
      }
      setBusy(false);
    } else {
      order = {
        id: Store.nextOrderId(), date: new Date().toISOString(),
        items: lines.map(l => ({ id: l.id, name: l.p.name, price: Store.price(l.p), qty: l.qty })),
        subtotal, mode, courierZone, courierCharge: shipping, giftWrap: gift, giftFee, giftMessage: gift ? giftMsg : '', total,
        userEmail: user?.email || '', customer, status: 'Awaiting payment'
      };
    }
    Store.setProfile(user?.email, { phone: f.phone, address: f.address, city: f.city, pin: f.pin });
    Store.upsertOrder(order);
    Store.setCart([]);
    notify('Order created', `${order.id} · ${money(order.total)} — complete the payment to confirm.`);
    nav(`/pay/${order.id}`);
  };

  return (
    <div className="cart-wrap">
      <ol className="flow wide">
        <li className="now"><span>1</span>Cart</li>
        <li><span>2</span>Details</li>
        <li><span>3</span>Pay</li>
        <li><span>4</span>Confirm</li>
      </ol>
      <section>
        <h1>Your cart</h1>
        {lines.map(l => (
          <div className="line card" key={l.id}>
            <img src={l.p.images[0]} alt="" />
            <div className="grow">
              <Link to={`/product/${l.id}`}><b>{l.p.name}</b></Link>
              <div className="muted">{money(Store.price(l.p))} each</div>
              <div className="qty small">
                <button onClick={() => change(l.id, -1)} aria-label="Less">−</button>
                <span>{l.qty}</span>
                <button onClick={() => change(l.id, 1)} aria-label="More">+</button>
              </div>
            </div>
            <div className="right">
              <b>{money(Store.price(l.p) * l.qty)}</b>
              <button className="link" onClick={() => remove(l.id)}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      <form className="card summary" onSubmit={place}>
        <h2>Order summary</h2>

        <div className="seg">
          <button type="button" className={mode === 'pickup' ? 'on' : ''} onClick={() => setMode('pickup')}>🤝 Pickup / hand over</button>
          <button type="button" className={mode === 'courier' ? 'on' : ''} onClick={() => setMode('courier')}>📮 Courier</button>
        </div>

        <input required placeholder="Your name" value={f.name} onChange={set('name')} autoComplete="name" />
        <input required placeholder="Phone / WhatsApp number" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" />

        {mode === 'courier' && <>
          <label className="lbl">Delivery location</label>
          <select value={zone} onChange={e => setZone(Number(e.target.value))}>
            {courier.map((c, i) => <option key={i} value={i}>{c.name} — {money(c.charge)}</option>)}
          </select>
          <textarea required placeholder="Full address" rows={3} value={f.address} onChange={set('address')} autoComplete="street-address" />
          <div className="two">
            <input required placeholder="City" value={f.city} onChange={set('city')} />
            <input required placeholder="PIN code" value={f.pin} onChange={set('pin')} inputMode="numeric" />
          </div>
        </>}
        <input placeholder="Note (optional)" value={f.note} onChange={set('note')} />

        <label className="switch gift">
          <input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} />
          <span>🎁 This is a gift — gift wrap {money(Store.data.settings.giftWrapFee)}</span>
        </label>
        {gift && <textarea rows={2} maxLength={300} placeholder="Message for the gift card" value={giftMsg} onChange={e => setGiftMsg(e.target.value)} />}

        <dl className="totals">
          <div><dt>Items ({lines.reduce((a, l) => a + l.qty, 0)})</dt><dd>{money(subtotal)}</dd></div>
          {mode === 'courier' && <div><dt>Courier ({z?.name})</dt><dd>{money(shipping)}</dd></div>}
          {giftFee > 0 && <div><dt>Gift wrap</dt><dd>{money(giftFee)}</dd></div>}
          <div className="grand"><dt>Total</dt><dd>{money(total)}</dd></div>
        </dl>
        {mode === 'courier' && <p className="muted small">Courier charges depend on your location and will be confirmed with you once the order is confirmed.</p>}
        {enabled && !user
          ? <Link className="btn block-btn" to="/login?next=/cart">Sign in with Google to place order</Link>
          : <button className="btn block-btn" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>}
      </form>
    </div>
  );
}
