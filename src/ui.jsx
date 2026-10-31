import { useEffect, useState } from 'react';
import { Store, art, driveId, money } from './store';
import { useAuth } from './auth';
import { REMOTE, api } from './api';
import { Link } from 'react-router-dom';

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
        <Img src={p.images[0]} w={500} alt={p.name} loading="lazy" />
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
  const { enabled, user, getToken } = useAuth();
  const list = Store.reviews(productId);
  const { n, avg } = Store.rating(productId);
  const lastName = (() => { try { return localStorage.getItem('ddt.reviewer') || ''; } catch { return ''; } })();
  const [f, setF] = useState({ name: user?.name || lastName, rating: 5, text: '' });
  const [sent, setSent] = useState(null);

  const submit = async e => {
    e.preventDefault();
    const r = { productId, name: f.name.trim(), rating: f.rating, text: f.text.trim() };
    if (REMOTE) {
      try { Store.setReviews((await api.addReview(await getToken(), r)).reviews); }
      catch (err) { return toast(err.message); }
    } else Store.addReview(r);
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

      {enabled && !user && (
        <div className="card form">
          <b>{productId ? 'Review this product' : 'Share your experience with us'}</b>
          <p className="muted small" style={{ margin: 0 }}>Sign in with Google to write a review.</p>
          <Link className="btn" to="/login">Sign in</Link>
        </div>
      )}
      <form className="card form" onSubmit={submit} hidden={enabled && !user}>
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

const ICONS = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  star: <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />,
  bag: <><path d="M6 7h12l1 13H5L6 7z" /><path d="M9 7a3 3 0 016 0" /></>,
  box: <><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" /></>,
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
};
export const Icon = ({ name, size = 22 }) => (
  <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

export const STEPS = ['Awaiting payment', 'Payment sent', 'Confirmed', 'Shipped', 'Delivered'];

/** Order progress tracker. */
export function Timeline({ status }) {
  if (status === 'Cancelled') return <p className="notice small">This order was cancelled.</p>;
  const at = Math.max(0, STEPS.indexOf(status));
  return (
    <ol className="timeline">
      {STEPS.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>
          <span className="node">{i < at ? <Icon name="check" size={12} /> : i + 1}</span>
          <small>{s}</small>
        </li>
      ))}
    </ol>
  );
}

/** Turn whatever the admin pasted (embed code, Maps link, coordinates or plain address) into {embed, link}. */
export function mapParts(input, address = '') {
  const v = (input || '').trim();
  if (!v) return null;
  const src = v.match(/src=["']([^"']+)["']/)?.[1] || v;
  const search = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const embedQ = q => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
  if (/^https:\/\/www\.google\.[a-z.]+\/maps\/embed/.test(src)) return { embed: src, link: search(address || 'DD_Treasure26') };
  if (/^https?:\/\//.test(src)) {
    const at = src.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || src.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (at) return { embed: embedQ(`${at[1]},${at[2]}`), link: src };
    const q = src.match(/[?&](?:q|query)=([^&]+)/);
    if (q) return { embed: embedQ(decodeURIComponent(q[1].replace(/\+/g, ' '))), link: src };
    // short links (maps.app.goo.gl) cannot be embedded: embed the address instead, link to the pasted URL
    return { embed: address ? embedQ(address) : '', link: src };
  }
  return { embed: embedQ(v), link: search(v) };
}

export function MapBlock() {
  const s = Store.data.settings;
  const m = mapParts(s.mapInput, s.address);
  if (!m) return null;
  return (
    <div className="mapbox">
      {m.embed && <iframe src={m.embed} title="Shop location" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
      <a className="btn small" href={m.link} target="_blank" rel="noreferrer">📍 Get directions</a>
    </div>
  );
}

const FALLBACK_IMG = art('📿', '#fff1e6', '#f6c1cf');

/** <img> that tries Google's CDN, then Drive's download link, then a friendly placeholder. */
export function Img({ src, w = 600, alt = '', ...rest }) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [src]);
  const id = driveId(src);
  const urls = id
    ? [`https://lh3.googleusercontent.com/d/${id}=w${w}`, `https://drive.usercontent.google.com/download?id=${id}&export=view`, FALLBACK_IMG]
    : [src || FALLBACK_IMG, FALLBACK_IMG];
  return (
    <img src={urls[Math.min(step, urls.length - 1)]} alt={alt} referrerPolicy="no-referrer" decoding="async"
      onError={() => setStep(n => n + 1)} {...rest} />
  );
}
