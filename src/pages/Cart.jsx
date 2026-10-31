import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { REMOTE, api } from '../api';
import { Store, cartKey, money, variantLabel } from '../store';
import { notify, toast, Img } from '../ui';

export default function Cart() {
  const nav = useNavigate();
  const { enabled, user, getToken } = useAuth();
  const { courier } = Store.data.settings;
  const lines = Store.cart()
    .map(l => ({ ...l, p: Store.product(l.id) }))
    .filter(l => l.p && l.p.qty > 0)
    .map(l => ({ ...l, qty: Math.min(l.qty, l.p.qty) }));
  // a line saved before the product got options must be re-added with a choice
  const needsChoice = l => (l.p.options || []).some(g => !l.sel?.[g.name]);

  const [mode, setMode] = useState('pickup');
  const [zone, setZone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(''); // code currently applied
  const [discount, setDiscount] = useState(0);
  const [couponBusy, setCouponBusy] = useState(false);
  const [f, setF] = useState(() => ({ name: user?.name || '', note: '', ...Store.profile(user?.email) }));
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const sync = next => Store.setCart(next.map(({ id, qty, sel, label }) => ({ id, qty, sel, label })));
  const change = (key, d) => sync(lines.map(l => cartKey(l) === key ? { ...l, qty: Math.max(1, Math.min(l.p.qty, l.qty + d)) } : l));
  const remove = key => sync(lines.filter(l => cartKey(l) !== key));

  const subtotal = lines.reduce((a, l) => a + Store.price(l.p) * l.qty, 0);
  const z = courier[zone];
  const shipping = mode === 'courier' && z ? Number(z.charge) : 0;
  const giftFee = gift ? Number(Store.data.settings.giftWrapFee) || 0 : 0;
  const total = subtotal - discount + shipping + giftFee;
  const items = lines.map(l => ({ id: l.id, qty: l.qty, sel: l.sel || {} }));
  const sig = lines.map(l => `${cartKey(l)}x${l.qty}`).join(',');

  // keep an applied coupon honest when the cart changes (the server recomputes it again on order)
  useEffect(() => {
    if (!applied || !REMOTE || !user) return;
    let off = false;
    (async () => {
      try { const r = await api.checkCoupon(await getToken(), items, applied); if (!off) setDiscount(r.discount); }
      catch (e) { if (!off) { setApplied(''); setDiscount(0); toast(e.message); } }
    })();
    return () => { off = true; };
  }, [sig, applied]);

  if (!lines.length) {
    return <div className="empty"><p>Your cart is empty 🛍️</p><Link className="btn" to="/">Start shopping</Link></div>;
  }

  const applyCoupon = async () => {
    const c = code.trim();
    if (!c) return;
    setCouponBusy(true);
    try {
      const r = await api.checkCoupon(await getToken(), items, c);
      setApplied(r.code); setDiscount(r.discount); setCode('');
      toast(`${r.code} applied · ${r.label}`);
    } catch (e) { toast(e.message); }
    setCouponBusy(false);
  };
  const removeCoupon = () => { setApplied(''); setDiscount(0); };

  const place = async e => {
    e.preventDefault();
    if (busy) return;
    if (lines.some(needsChoice)) return toast('Please choose a size/option for the highlighted items');
    if (!/^\+?[\d\s-]{10,15}$/.test(f.phone)) return toast('Enter a valid phone number');
    const customer = { name: f.name, phone: f.phone, address: f.address, city: f.city, pin: f.pin, note: f.note };
    const courierZone = mode === 'courier' ? z?.name : '';
    let order;
    if (REMOTE) {
      setBusy(true);
      try {
        order = (await api.placeOrder(await getToken(), {
          items, mode, courierZone, coupon: applied,
          giftWrap: gift, giftMessage: gift ? giftMsg : '', customer
        })).order;
      } catch (err) {
        toast(err.message); Store.refresh(); setBusy(false);
        if (err.code === 'auth') nav('/login?next=/cart');
        if (err.code === 'coupon') { setApplied(''); setDiscount(0); }
        return;
      }
      setBusy(false);
    } else {
      order = {
        id: Store.nextOrderId(), date: new Date().toISOString(),
        items: lines.map(l => ({ id: l.id, name: l.p.name, price: Store.price(l.p), qty: l.qty, sel: l.sel || {}, variant: variantLabel(l.p, l.sel) })),
        subtotal, discount: 0, coupon: null, mode, courierZone, courierCharge: shipping, giftWrap: gift, giftFee, giftMessage: gift ? giftMsg : '', total,
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
        {lines.map(l => {
          const key = cartKey(l);
          return (
            <div className={`line card${needsChoice(l) ? ' warn' : ''}`} key={key}>
              <Img src={l.p.images[0]} w={160} alt="" />
              <div className="grow">
                <Link to={`/product/${l.id}`}><b>{l.p.name}</b></Link>
                {l.label && <div className="opt">{l.label}</div>}
                {needsChoice(l) && <div className="small"><Link to={`/product/${l.id}`}>Choose options</Link></div>}
                <div className="muted">{money(Store.price(l.p))} each</div>
                <div className="qty small">
                  <button onClick={() => change(key, -1)} aria-label="Less">−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => change(key, 1)} aria-label="More">+</button>
                </div>
              </div>
              <div className="right">
                <b>{money(Store.price(l.p) * l.qty)}</b>
                <button className="link" onClick={() => remove(key)}>Remove</button>
              </div>
            </div>
          );
        })}
      </section>

      <form id="checkout" className="card summary" onSubmit={place}>
        <h2>Checkout</h2>

        <fieldset className="sec">
          <legend><span>1</span> Delivery</legend>
          <div className="seg">
            <button type="button" className={mode === 'pickup' ? 'on' : ''} onClick={() => setMode('pickup')}>🤝 Pickup / hand over</button>
            <button type="button" className={mode === 'courier' ? 'on' : ''} onClick={() => setMode('courier')}>📮 Courier</button>
          </div>
          {mode === 'courier' ? <>
            <label>Delivery location
              <select value={zone} onChange={e => setZone(Number(e.target.value))}>
                {courier.map((c, i) => <option key={i} value={i}>{c.name} — {money(c.charge)}</option>)}
              </select>
            </label>
            <label>Full address<textarea required rows={3} value={f.address} onChange={set('address')} autoComplete="street-address" /></label>
            <div className="two">
              <label>City<input required value={f.city} onChange={set('city')} /></label>
              <label>PIN code<input required value={f.pin} onChange={set('pin')} inputMode="numeric" /></label>
            </div>
          </> : <p className="muted small" style={{ margin: 0 }}>Collect from us or we hand it over to you. No delivery charge.</p>}
        </fieldset>

        <fieldset className="sec">
          <legend><span>2</span> Your details</legend>
          <label>Name<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
          <label>Phone / WhatsApp number<input required value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></label>
          <label>Note for us (optional)<input value={f.note} onChange={set('note')} /></label>
        </fieldset>

        <fieldset className="sec">
          <legend><span>3</span> Gift &amp; offers</legend>
          <label className="switch gift">
            <input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} />
            <span>🎁 This is a gift — gift wrap {money(Store.data.settings.giftWrapFee)}</span>
          </label>
          {gift && <textarea rows={2} maxLength={300} placeholder="Message for the gift card" value={giftMsg} onChange={e => setGiftMsg(e.target.value)} aria-label="Gift card message" />}

          {REMOTE && user && (applied ? (
            <div className="coupon applied">
              <span>🏷️ <b>{applied}</b> applied</span>
              <button type="button" className="link" onClick={removeCoupon}>Remove</button>
            </div>
          ) : (
            <div className="coupon">
              <input placeholder="Coupon code" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} autoCapitalize="characters" aria-label="Coupon code" />
              <button type="button" className="btn ghost small" disabled={couponBusy || !code.trim()} onClick={applyCoupon}>{couponBusy ? '…' : 'Apply'}</button>
            </div>
          ))}
        </fieldset>

        <div className="bill">
          <h3>Bill details</h3>
          <dl className="totals">
            <div><dt>Items ({lines.reduce((a, l) => a + l.qty, 0)})</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 && <div className="disc"><dt>Coupon {applied}</dt><dd>−{money(discount)}</dd></div>}
            {mode === 'courier' && <div><dt>Courier ({z?.name})</dt><dd>{money(shipping)}</dd></div>}
            {giftFee > 0 && <div><dt>Gift wrap</dt><dd>{money(giftFee)}</dd></div>}
            <div className="grand"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
          {mode === 'courier' && <p className="muted small" style={{ margin: 0 }}>Courier charges depend on your location and are confirmed with you once the order is confirmed.</p>}
        </div>

        <div className="place-inline">
          {enabled && !user
            ? <Link className="btn block-btn" to="/login?next=/cart">Sign in with Google to place order</Link>
            : <button className="btn block-btn" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>}
        </div>
      </form>

      <div className="checkout-bar">
        <div><small>Total</small><b>{money(total)}</b></div>
        {enabled && !user
          ? <Link className="btn" to="/login?next=/cart">Sign in to order</Link>
          : <button type="submit" form="checkout" className="btn" disabled={busy}>{busy ? 'Placing…' : 'Place order'}</button>}
      </div>
    </div>
  );
}
