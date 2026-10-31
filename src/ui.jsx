import { useEffect, useState } from 'react';
import { Store, money } from './store';

const toastBus = new EventTarget();
export const toast = msg => toastBus.dispatchEvent(new CustomEvent('t', { detail: msg }));

export function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t;
    const h = e => { setMsg(e.detail); clearTimeout(t); t = setTimeout(() => setMsg(''), 2200); };
    toastBus.addEventListener('t', h);
    return () => { toastBus.removeEventListener('t', h); clearTimeout(t); };
  }, []);
  return <div id="toast" className={msg ? 'show' : ''} role="status">{msg}</div>;
}

export const stockLabel = p => {
  const low = Store.data.settings.lowStockAt;
  if (p.qty <= 0) return { text: 'Sold out', cls: 'out' };
  if (p.qty <= low) return { text: `Only ${p.qty} left!`, cls: 'low' };
  return { text: 'In stock', cls: 'ok' };
};

export function Price({ p }) {
  const now = Store.price(p);
  return (
    <span className="price">
      <b>{money(now)}</b>
      {now < p.price && <s>{money(p.price)}</s>}
    </span>
  );
}

export function ProductCard({ p, onOpen }) {
  const st = stockLabel(p);
  const off = Store.price(p) < p.price ? Math.round((1 - Store.price(p) / p.price) * 100) : 0;
  return (
    <article className="card product" onClick={() => onOpen(p.id)} tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}>
      <div className="thumb">
        <img src={p.images[0]} alt={p.name} loading="lazy" />
        {off > 0 && <span className="badge">{off}% off</span>}
        {st.cls === 'out' && <span className="badge dark">Sold out</span>}
      </div>
      <div className="info">
        <small className="muted">{p.category}</small>
        <h3>{p.name}</h3>
        <RatingSummary productId={p.id} />
        <Price p={p} />
        {st.cls === 'low' && <small className="low">{st.text}</small>}
      </div>
    </article>
  );
}

export function waLink(number, text) {
  return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function notify(title, body) {
  try {
    if (!Store.prefs().notify || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'assets/icon-192.png' }));
    } else {
      new Notification(title, { body, icon: 'assets/icon-192.png' });
    }
  } catch { /* notifications unsupported */ }
}

export function Stars({ value, size = '1em' }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => <i key={i} className={value >= i - 0.25 ? 'on' : value >= i - 0.75 ? 'half' : ''}>★</i>)}
    </span>
  );
}

export function RatingSummary({ productId }) {
  const { n, avg } = Store.rating(productId);
  if (!n) return null;
  return <span className="rating"><Stars value={avg} /> <small className="muted">{avg.toFixed(1)} ({n})</small></span>;
}

/** Review list + form. productId: a product id, or null for general shop reviews. */
export function Reviews({ productId = null, productName = '' }) {
  const list = Store.reviews(productId);
  const { n, avg } = Store.rating(productId);
  const lastName = (() => { try { return localStorage.getItem('ddt.reviewer') || ''; } catch { return ''; } })();
  const [f, setF] = useState({ name: lastName, rating: 5, text: '' });
  const [sent, setSent] = useState(null);

  const submit = e => {
    e.preventDefault();
    const r = { productId, name: f.name.trim(), rating: f.rating, text: f.text.trim() };
    Store.addReview(r);
    try { localStorage.setItem('ddt.reviewer', r.name); } catch { /* ignore */ }
    setSent(r);
    setF({ ...f, text: '', rating: 5 });
    toast('Thank you for your review 💗');
  };
  const wa = r => waLink(Store.data.settings.whatsapp,
    `Review for ${productName ? `"${productName}"` : 'DD_Treasure26'}\n${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}\n"${r.text}"\n— ${r.name}`);

  return (
    <section className="reviews">
      <div className="row between">
        <h2>{productId ? 'Customer reviews' : 'What our customers say'}</h2>
        {n > 0 && <span className="rating"><Stars value={avg} size="1.2em" /> <b>{avg.toFixed(1)}</b> <small className="muted">({n})</small></span>}
      </div>

      <form className="card form" onSubmit={submit}>
        <b>{productId ? 'Review this product' : 'Share your experience with us'}</b>
        <div className="starpick" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map(i => (
            <button type="button" key={i} role="radio" aria-checked={f.rating === i} className={f.rating >= i ? 'on' : ''}
              onClick={() => setF({ ...f, rating: i })} aria-label={`${i} star${i > 1 ? 's' : ''}`}>★</button>
          ))}
        </div>
        <input required maxLength={40} placeholder="Your name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <textarea required rows={3} maxLength={600} placeholder="Write your review…" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        <button className="btn">Submit review</button>
        {sent && (
          <p className="notice small">
            Saved. Please also <a href={wa(sent)} target="_blank" rel="noreferrer">send it to us on WhatsApp</a> so we can publish it for everyone.
          </p>
        )}
      </form>

      {list.length ? list.map(r => (
        <div className="card review" key={r.id}>
          <div className="row between">
            <b>{r.name}</b>
            <Stars value={r.rating} />
          </div>
          {!productId && r.productId && Store.product(r.productId) && (
            <small className="muted">on {Store.product(r.productId).name}</small>
          )}
          <p>{r.text}</p>
          <small className="muted">{new Date(r.date).toLocaleDateString()}</small>
        </div>
      )) : <div className="empty">No reviews yet – be the first!</div>}
    </section>
  );
}
