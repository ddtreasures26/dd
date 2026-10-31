import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { REMOTE, api } from '../api';
import { Store, fileToDataURL, money, useStore } from '../store';
import { ADMIN_EMAIL } from '../config';
import { Stars, notify, toast, waLink, Img } from '../ui';
import { GoogleButton, useAuth } from '../auth';

const SECTIONS = [
  { k: 'orders', label: 'Orders', icon: '📦', main: true },
  { k: 'products', label: 'Products', icon: '🛍️', main: true },
  { k: 'coupons', label: 'Coupons', icon: '🏷️', main: true },
  { k: 'analytics', label: 'Insights', icon: '📊', main: true },
  { k: 'categories', label: 'Categories', icon: '🗂️' },
  { k: 'home', label: 'Home & promos', icon: '🏠' },
  { k: 'shop', label: 'Shop details', icon: '🏪' },
  { k: 'courier', label: 'Courier', icon: '📮' },
  { k: 'reviews', label: 'Reviews', icon: '⭐' },
  { k: 'data', label: 'Backup', icon: '💾' }
];

const save = async scope => {
  const ok = await Store.commit(scope);
  toast(ok ? (REMOTE ? 'Saved & published ✓' : 'Saved ✓') : (Store.lastError || 'Storage full – use smaller/fewer images'));
};

export default function Admin() {
  useStore();
  const auth = useAuth();
  const [ok, setOk] = useState(() => sessionStorage.getItem('ddt.admin') === '1');
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState(() => {
    try { const t = sessionStorage.getItem('ddt.admin.tab'); return SECTIONS.some(x => x.k === t) ? t : 'orders'; } catch { return 'orders'; }
  });
  const [more, setMore] = useState(false);
  const [ready, setReady] = useState(!REMOTE);

  // Pull the latest catalog, every order and every review (incl. hidden) before the admin edits anything.
  useEffect(() => {
    if (!REMOTE || !auth.isAdmin) return;
    (async () => {
      try { await Store.refresh(); await Store.loadAdminData(); } catch (e) { toast(e.message); }
      setReady(true);
    })();
  }, [auth.isAdmin]);

  if (auth.enabled) {
    if (!auth.user) {
      return <div className="card login"><h1>Admin</h1><p className="muted">Sign in with the shop Google account.</p><GoogleButton /></div>;
    }
    if (!auth.isAdmin) {
      return (
        <div className="card login">
          <h1>No access</h1>
          <p className="muted">{auth.user.email} is not the admin account.</p>
          <button className="btn ghost" onClick={auth.signOut}>Log out</button>
        </div>
      );
    }
  } else if (!ok) {
    return (
      <form className="card login" onSubmit={e => {
        e.preventDefault();
        if (pin === Store.data.settings.adminPin) { sessionStorage.setItem('ddt.admin', '1'); setOk(true); }
        else toast('Wrong PIN');
      }}>
        <h1>Admin</h1>
        <p className="muted small">Test mode: enter the admin PIN (default 1234). Google sign-in for {ADMIN_EMAIL} comes with the Drive step.</p>
        <input type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
        <button className="btn">Enter</button>
      </form>
    );
  }

  if (!ready) return <div className="empty">Loading shop data…</div>;

  const go = k => { setTab(k); setMore(false); try { sessionStorage.setItem('ddt.admin.tab', k); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const logout = () => { sessionStorage.removeItem('ddt.admin'); setOk(false); auth.signOut(); };
  const orders = REMOTE ? Store.adminOrders : Store.orders();
  const openOrders = orders.filter(o => o.status === 'Awaiting payment' || o.status === 'Payment sent').length;
  const pendingReviews = Store.data.reviews.filter(r => r.pending).length;
  const badge = k => (k === 'orders' ? openOrders : k === 'reviews' ? pendingReviews : 0);
  const current = SECTIONS.find(x => x.k === tab);
  const rest = SECTIONS.filter(x => !x.main);
  const moreCount = badge('reviews');

  return (
    <div className="admin-shell">
      <aside className="admin-nav" aria-label="Admin sections">
        {SECTIONS.map(x => (
          <button key={x.k} className={tab === x.k ? 'on' : ''} onClick={() => go(x.k)} aria-current={tab === x.k ? 'page' : undefined}>
            <span className="ni">{x.icon}</span><span className="grow">{x.label}</span>{badge(x.k) > 0 && <i className="nb">{badge(x.k)}</i>}
          </button>
        ))}
        <button className="btn ghost small" onClick={logout}>Log out</button>
      </aside>

      <section className="admin-main">
        <div className="admin-head">
          <h1>{current.icon} {current.label}</h1>
          <button className="btn ghost small only-m" onClick={logout}>Log out</button>
        </div>

        {(tab === 'orders' || tab === 'products') && (
          <div className="stats four compact">
            <div className="card stat"><b>{Store.data.products.length}</b><small>Products</small></div>
            <div className="card stat"><b>{Store.data.products.filter(p => p.qty <= Store.data.settings.lowStockAt).length}</b><small>Low stock</small></div>
            <div className="card stat"><b>{openOrders}</b><small>To do</small></div>
            <div className="card stat"><b>{Store.reviews('all').length}</b><small>Reviews</small></div>
          </div>
        )}
        {REMOTE && !Store.published && (
          <div className="notice">
            Your shop is empty online, so customers see nothing yet. Add products, or publish the starter samples to begin.{' '}
            <button className="btn small" onClick={async () => { Store.reset(); await save(); }}>Publish starter products</button>
          </div>
        )}

        {tab === 'products' && <Products />}
        {tab === 'categories' && <Categories />}
        {tab === 'home' && <HomeSettings />}
        {tab === 'shop' && <ShopSettings />}
        {tab === 'courier' && <Courier />}
        {tab === 'coupons' && <Coupons />}
        {tab === 'orders' && <AdminOrders />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'reviews' && <AdminReviews />}
        {tab === 'data' && <Backup />}
      </section>

      <nav className="admin-tabbar" aria-label="Admin sections">
        {SECTIONS.filter(x => x.main).map(x => (
          <button key={x.k} className={tab === x.k ? 'on' : ''} onClick={() => go(x.k)} aria-current={tab === x.k ? 'page' : undefined}>
            <span className="ti">{x.icon}{badge(x.k) > 0 && <i className="nb">{badge(x.k)}</i>}</span><small>{x.label}</small>
          </button>
        ))}
        <button className={rest.some(x => x.k === tab) ? 'on' : ''} onClick={() => setMore(true)}>
          <span className="ti">☰{moreCount > 0 && <i className="nb">{moreCount}</i>}</span><small>More</small>
        </button>
      </nav>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" role="dialog" aria-label="More sections" onClick={e => e.stopPropagation()}>
            <div className="row between"><h3>More</h3><button className="link" onClick={() => setMore(false)}>Close</button></div>
            <div className="sheet-grid">
              {rest.map(x => (
                <button key={x.k} className={tab === x.k ? 'on' : ''} onClick={() => go(x.k)}>
                  <span className="ni">{x.icon}</span><span>{x.label}</span>{badge(x.k) > 0 && <i className="nb">{badge(x.k)}</i>}
                </button>
              ))}
            </div>
            <button className="btn ghost" onClick={logout}>Log out</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Products ---------- */
const OPTION_PRESETS = [
  { name: 'Ring size', values: '6, 7, 8, 9, 10, 11' },
  { name: 'Bracelet size', values: 'S, M, L' },
  { name: 'Colour', values: 'Gold, Silver, Rose gold' }
];
const parseOptions = list => (list || [])
  .map(g => ({ name: g.name.trim(), values: [...new Set(g.valuesText.split(',').map(x => x.trim()).filter(Boolean))] }))
  .filter(g => g.name && g.values.length);

const blank = () => ({ id: '', name: '', category: Store.data.categories[0] || '', price: '', offerPrice: '', qty: 1, offer: false, images: [], description: '' });

function Products() {
  const [e, setE] = useState(null);
  const { products } = Store.data;

  if (e) return <ProductForm init={e} onDone={() => setE(null)} />;
  return (
    <>
      <button className="btn" onClick={() => setE(blank())}>+ Add product</button>
      <div className="table">
        {products.map(p => (
          <div className="trow card" key={p.id}>
            <Img src={p.images[0]} w={120} alt="" />
            <div className="grow"><b>{p.name}</b><div className="muted small">{p.category} · {money(p.price)}{p.offer && p.offerPrice ? ` → ${money(p.offerPrice)}` : ''} · qty {p.qty}</div></div>
            <button className="btn ghost small" onClick={() => setE({ ...p })}>Edit</button>
            <button className="btn ghost small danger" onClick={() => {
              if (!confirm(`Delete "${p.name}"?`)) return;
              Store.data.products = products.filter(x => x.id !== p.id); save();
            }}>Delete</button>
          </div>
        ))}
        {!products.length && <div className="empty">No products yet.</div>}
      </div>
    </>
  );
}

function ProductForm({ init, onDone }) {
  const [p, setP] = useState(() => ({ ...init, options: (init.options || []).map(g => ({ name: g.name, valuesText: g.values.join(', ') })) }));
  const set = k => ev => setP({ ...p, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const addImgs = async ev => {
    const urls = await Promise.all([...ev.target.files].map(f => fileToDataURL(f)));
    setP(x => ({ ...x, images: [...x.images, ...urls] }));
    ev.target.value = '';
  };
  const submit = ev => {
    ev.preventDefault();
    const clean = { ...p, id: p.id || Store.uid(), createdAt: p.createdAt || Date.now(), options: parseOptions(p.options), price: Number(p.price), offerPrice: Number(p.offerPrice) || 0, qty: Math.max(0, parseInt(p.qty) || 0) };
    if (!clean.images.length) clean.images = [Store.data.settings.logo];
    const list = Store.data.products;
    Store.data.products = list.some(x => x.id === clean.id) ? list.map(x => x.id === clean.id ? clean : x) : [clean, ...list];
    save(); onDone();
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2>{init.id ? 'Edit product' : 'Add product'}</h2>
      <label>Name<input required value={p.name} onChange={set('name')} /></label>
      <label>Category
        <select value={p.category} onChange={set('category')}>
          {Store.data.categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div className="two">
        <label>Price (₹)<input required type="number" min="0" value={p.price} onChange={set('price')} /></label>
        <label>Available quantity<input required type="number" min="0" value={p.qty} onChange={set('qty')} /></label>
      </div>
      <label className="switch"><input type="checkbox" checked={p.offer} onChange={set('offer')} /><span>Show in Offer zone</span></label>
      {p.offer && <label>Offer price (₹)<input type="number" min="0" value={p.offerPrice} onChange={set('offerPrice')} /></label>}
      <label>Description<textarea rows={4} value={p.description} onChange={set('description')} /></label>
      <div className="sub">
        <b>Options (optional)</b>
        <p className="muted small" style={{ margin: 0 }}>For sizes or colours. The customer must pick one value from every group. Stock is shared by all options.</p>
        {p.options.map((g, i) => (
          <div className="optrow" key={i}>
            <input placeholder="Option name, e.g. Ring size" value={g.name} onChange={e => setP({ ...p, options: p.options.map((x, k) => k === i ? { ...x, name: e.target.value } : x) })} />
            <input placeholder="Values, separated by commas: 6, 7, 8" value={g.valuesText} onChange={e => setP({ ...p, options: p.options.map((x, k) => k === i ? { ...x, valuesText: e.target.value } : x) })} />
            <button type="button" className="btn ghost small danger" aria-label="Remove option" onClick={() => setP({ ...p, options: p.options.filter((_, k) => k !== i) })}>×</button>
          </div>
        ))}
        <div className="row">
          {OPTION_PRESETS.map(pr => (
            <button type="button" key={pr.name} className="btn ghost small" onClick={() => setP({ ...p, options: [...p.options, { name: pr.name, valuesText: pr.values }] })}>+ {pr.name}</button>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setP({ ...p, options: [...p.options, { name: '', valuesText: '' }] })}>+ Custom</button>
        </div>
      </div>
      <label>Photos<input type="file" accept="image/*" multiple onChange={addImgs} /></label>
      <div className="thumbs">
        {p.images.map((s, i) => (
          <span key={i} className="rm"><Img src={s} w={160} alt="" /><button type="button" onClick={() => setP({ ...p, images: p.images.filter((_, k) => k !== i) })} aria-label="Remove photo">×</button></span>
        ))}
      </div>
      <div className="row">
        <button className="btn">Save</button>
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------- Categories ---------- */
function Categories() {
  const [name, setName] = useState('');
  const { categories, products } = Store.data;
  return (
    <div className="card form">
      <form className="row" onSubmit={e => {
        e.preventDefault();
        const n = name.trim();
        if (!n || categories.includes(n)) return;
        Store.data.categories = [...categories, n]; setName(''); save();
      }}>
        <input placeholder="New category" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn">Add</button>
      </form>
      {categories.map(c => (
        <div className="trow" key={c}>
          <span className="grow">{c} <small className="muted">({products.filter(p => p.category === c).length})</small></span>
          <button className="btn ghost small danger" onClick={() => {
            if (products.some(p => p.category === c)) return toast('Move or delete its products first');
            Store.data.categories = categories.filter(x => x !== c); save();
          }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Image picker helper ---------- */
function ImageField({ label, value, onChange, max = 900 }) {
  const ref = useRef();
  return (
    <div className="imgfield">
      <span className="lbl">{label}</span>
      {value && <Img src={value} w={400} alt="" />}
      <div className="row">
        <button type="button" className="btn ghost small" onClick={() => ref.current.click()}>{value ? 'Change' : 'Upload'}</button>
        {value && <button type="button" className="btn ghost small" onClick={() => onChange('')}>Remove</button>}
      </div>
      <input ref={ref} hidden type="file" accept="image/*" onChange={async e => { if (e.target.files[0]) onChange(await fileToDataURL(e.target.files[0], max)); e.target.value = ''; }} />
    </div>
  );
}

/* ---------- Home & promos ---------- */
function HomeSettings() {
  const s = Store.data.settings;
  const [banners, setB] = useState(s.banners);
  const [video, setV] = useState(s.promoVideo);
  const upd = (i, patch) => setB(banners.map((b, k) => k === i ? { ...b, ...patch } : b));
  return (
    <div className="card form">
      <h2>Home carousel</h2>
      {banners.map((b, i) => (
        <div className="sub" key={i}>
          <ImageField label={`Slide ${i + 1} image`} value={b.image} onChange={v => upd(i, { image: v })} max={1400} />
          <input placeholder="Title" value={b.title} onChange={e => upd(i, { title: e.target.value })} />
          <input placeholder="Text" value={b.text} onChange={e => upd(i, { text: e.target.value })} />
          <button type="button" className="btn ghost small danger" onClick={() => setB(banners.filter((_, k) => k !== i))}>Remove slide</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => setB([...banners, { title: '', text: '', image: '' }])}>+ Add slide</button>
      <h2>Promo video</h2>
      <input placeholder="YouTube or Google Drive video link, or direct .mp4 URL" value={video} onChange={e => setV(e.target.value)} />
      <p className="muted small">Offer zone shows products with “Show in Offer zone” ticked.</p>
      <button className="btn" onClick={() => { s.banners = banners.filter(b => b.image); s.promoVideo = video.trim(); save(); }}>Save</button>
    </div>
  );
}

/* ---------- Shop details ---------- */
function ShopSettings() {
  const [s, setS] = useState({ ...Store.data.settings });
  const set = k => e => setS({ ...s, [k]: e.target.value });
  return (
    <form className="card form" onSubmit={e => { e.preventDefault(); Object.assign(Store.data.settings, s, { lowStockAt: Number(s.lowStockAt) || 10, giftWrapFee: Math.max(0, Number(s.giftWrapFee) || 0) }); save(); }}>
      <ImageField label="Logo" value={s.logo} onChange={v => setS({ ...s, logo: v || 'assets/logo.png' })} max={512} />
      <label>Shop name<input value={s.shopName} onChange={set('shopName')} /></label>
      <label>Tagline<input value={s.tagline} onChange={set('tagline')} /></label>
      <label>About us<textarea rows={4} value={s.about} onChange={set('about')} /></label>
      <label>Address<textarea rows={2} value={s.address} onChange={set('address')} /></label>
      <label>Map location (shown in the footer)
        <textarea rows={3} value={s.mapInput} onChange={set('mapInput')} placeholder="Paste a Google Maps link, the “Embed a map” code, or just your address" />
      </label>
      <p className="muted small" style={{ margin: 0 }}>Easiest: in Google Maps open your shop → Share → <b>Embed a map</b> → copy HTML and paste it here. Leave empty to hide the map.</p>
      <label>Phone<input value={s.phone} onChange={set('phone')} /></label>
      <label>WhatsApp number (with country code, digits only)<input value={s.whatsapp} onChange={set('whatsapp')} inputMode="numeric" /></label>
      <label>Email<input value={s.email} onChange={set('email')} /></label>
      <label>Instagram link<input value={s.instagram} onChange={set('instagram')} /></label>
      <h2>Payment</h2>
      <label>UPI ID (optional, enables “Open UPI app”)<input value={s.upiId} onChange={set('upiId')} placeholder="name@bank" /></label>
      <ImageField label="GPay / UPI QR image" value={s.qrImage} onChange={v => setS({ ...s, qrImage: v })} max={700} />
      <h2>Other</h2>
      <label>Show “only N left” when stock is at or below<input type="number" min="1" value={s.lowStockAt} onChange={set('lowStockAt')} /></label>
      <label>Gift wrap fee (₹)<input type="number" min="0" value={s.giftWrapFee} onChange={set('giftWrapFee')} /></label>
      <label>Admin PIN (only used when Google sign-in is off)<input value={s.adminPin} onChange={set('adminPin')} /></label>
      <button className="btn">Save</button>
    </form>
  );
}

/* ---------- Courier ---------- */
function Courier() {
  const [z, setZ] = useState(Store.data.settings.courier);
  const upd = (i, patch) => setZ(z.map((x, k) => k === i ? { ...x, ...patch } : x));
  return (
    <div className="card form">
      <h2>Courier charges by location</h2>
      {z.map((x, i) => (
        <div className="row" key={i}>
          <input className="grow" placeholder="Location" value={x.name} onChange={e => upd(i, { name: e.target.value })} />
          <input type="number" min="0" style={{ width: 100 }} value={x.charge} onChange={e => upd(i, { charge: e.target.value })} />
          <button className="btn ghost small danger" onClick={() => setZ(z.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
      <button className="btn ghost" onClick={() => setZ([...z, { name: '', charge: 0 }])}>+ Add location</button>
      <button className="btn" onClick={() => { Store.data.settings.courier = z.filter(x => x.name.trim()).map(x => ({ ...x, charge: Number(x.charge) || 0 })); save(); }}>Save</button>
    </div>
  );
}

/* ---------- Orders ---------- */
const STATUSES = ['Awaiting payment', 'Payment sent', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

function ChargeEditor({ o, onSave }) {
  const [v, setV] = useState(o.courierCharge);
  return (
    <label className="charge">Courier charge (₹): confirm it with the customer
      <div className="row nowrap">
        <input type="number" min="0" value={v} onChange={e => setV(e.target.value)} />
        <button className="btn small ghost" onClick={() => onSave(Number(v))}>Update</button>
      </div>
    </label>
  );
}

/** Indian mobile numbers are stored without a country code, wa.me needs one. */
const waNumber = phone => {
  const d = String(phone).replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d.length === 11 && d.startsWith('0') ? '91' + d.slice(1) : d;
};
const statusMessage = o => {
  const note = {
    'Payment sent': 'We have noted your payment and will confirm it shortly.',
    Confirmed: 'Your order is confirmed. We are getting it ready with love.',
    Shipped: 'Your order has been shipped.',
    Delivered: 'Your order has been delivered. We hope you love it!',
    Cancelled: 'Your order has been cancelled.',
    'Awaiting payment': 'We are waiting for your payment.'
  }[o.status] || '';
  const extra = o.mode === 'courier' ? ` Courier charge ${money(o.courierCharge)}, total ${money(o.total)}.` : ` Total ${money(o.total)}.`;
  return `Hi ${o.customer.name}, this is ${Store.data.settings.shopName} about your order ${o.id}. ${note}${extra}`;
};

const ORDER_FILTERS = [
  ['open', 'To do', o => o.status === 'Awaiting payment' || o.status === 'Payment sent'],
  ['active', 'In progress', o => o.status === 'Confirmed' || o.status === 'Shipped'],
  ['done', 'Completed', o => o.status === 'Delivered' || o.status === 'Cancelled'],
  ['all', 'All', () => true]
];

function AdminOrders() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState('open');
  const orders = REMOTE ? Store.adminOrders : Store.orders();

  // check for new orders every 45 s while this tab is open
  useEffect(() => {
    if (!REMOTE) return;
    let seen = Store.adminOrders.length;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        await Store.loadAdminData();
        const n = Store.adminOrders.length;
        if (n > seen) { toast('New order received 🎉'); notify('New order', `${n - seen} new order(s) to review`); }
        seen = n;
      } catch { /* offline */ }
    }, 45000);
    return () => clearInterval(t);
  }, []);

  const patch = async (o, p) => {
    if (!REMOTE) {
      Store.setOrders(Store.orders().map(x => x.id !== o.id ? x : {
        ...x, ...p, ...(p.courierCharge != null ? { total: x.subtotal - (x.discount || 0) + p.courierCharge + (x.giftFee || 0) } : {})
      }));
      return;
    }
    try {
      const r = await api.updateOrder(await getToken(), o.id, p);
      Store.applyAdminOrder(r.order, r.products);
      toast(p.status === 'Confirmed' ? 'Confirmed – stock updated ✓' : 'Updated ✓');
    } catch (e) { toast(e.message); }
  };

  const match = ORDER_FILTERS.find(f => f[0] === filter)[2];
  const shown = orders.filter(match);

  return (
    <>
      <div className="row between">
        <p className="muted small" style={{ margin: 0 }}>
          {REMOTE ? 'Live from Drive. Confirming an order reduces stock and updates the status the customer sees.' : 'Orders placed on this device (connect the backend to receive customers\' orders here).'}
        </p>
        {REMOTE && <button className="btn small ghost" onClick={() => Store.loadAdminData().then(() => toast('Refreshed')).catch(e => toast(e.message))}>Refresh</button>}
      </div>
      <div className="chips" role="tablist" aria-label="Order filter">
        {ORDER_FILTERS.map(([k, label, fn]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label} <small>({orders.filter(fn).length})</small>
          </button>
        ))}
      </div>

      {shown.map(o => (
        <article className="card order admin-order" key={o.id}>
          <div className="row between">
            <b>{o.id}</b>
            <span className={`pill ${o.status.replace(/\s/g, '').toLowerCase()}`}>{o.status}</span>
          </div>
          <div className="row between">
            <small className="muted">{new Date(o.date).toLocaleString()}</small>
            <b className="amt">{money(o.total)}</b>
          </div>

          <div className="cust">
            <b>{o.customer.name}</b>
            <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a>
            <span className="muted small">
              {o.mode === 'courier' ? `📮 ${o.customer.address}, ${o.customer.city} – ${o.customer.pin} (${o.courierZone})` : '🤝 Pickup / hand over'}
            </span>
            {o.customer.note && <span className="muted small">Note: {o.customer.note}</span>}
          </div>

          <ul className="oitems">
            {o.items.map((i, k) => (
              <li key={k}><span>{i.name}{i.variant && <small className="opt">{i.variant}</small>}</span><span className="muted">× {i.qty}</span></li>
            ))}
          </ul>
          {o.giftWrap && <p className="notice small">🎁 Gift wrap{o.giftMessage ? `: “${o.giftMessage}”` : ''}</p>}

          <dl className="totals compact">
            <div><dt>Items</dt><dd>{money(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="disc"><dt>Coupon {o.coupon?.code}</dt><dd>−{money(o.discount)}</dd></div>}
            {o.mode === 'courier' && <div><dt>Courier</dt><dd>{money(o.courierCharge)}</dd></div>}
            {o.giftFee > 0 && <div><dt>Gift wrap</dt><dd>{money(o.giftFee)}</dd></div>}
            <div className="grand"><dt>Total</dt><dd>{money(o.total)}</dd></div>
          </dl>

          {o.mode === 'courier' && <ChargeEditor key={o.courierCharge} o={o} onSave={c => patch(o, { courierCharge: c })} />}

          <label>Order status
            <select value={o.status} onChange={e => patch(o, { status: e.target.value })}>
              {STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
          </label>
          <div className="row actions-row">
            <a className="btn small wa" href={waLink(waNumber(o.customer.phone), statusMessage(o))} target="_blank" rel="noreferrer">💬 WhatsApp customer</a>
            <Link className="btn small ghost" to={`/invoice/${o.id}`}>Invoice</Link>
          </div>
        </article>
      ))}
      {!shown.length && <div className="empty">{orders.length ? 'Nothing in this list.' : 'No orders yet.'}</div>}
    </>
  );
}

/* ---------- Analytics ---------- */
function Analytics() {
  const orders = REMOTE ? Store.adminOrders : Store.orders();
  const sold = orders.filter(o => ['Confirmed', 'Shipped', 'Delivered'].includes(o.status));
  const open = orders.filter(o => ['Awaiting payment', 'Payment sent'].includes(o.status));
  const revenue = sold.reduce((a, o) => a + o.total, 0);
  const pending = open.reduce((a, o) => a + o.total, 0);

  const top = {};
  sold.forEach(o => o.items.forEach(i => {
    const e = (top[i.id] ||= { name: i.name, qty: 0, rev: 0 });
    e.qty += i.qty; e.rev += i.price * i.qty;
  }));
  const topList = Object.values(top).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const days = [...Array(14)].map((_, k) => { const d = new Date(); d.setDate(d.getDate() - (13 - k)); return d; });
  const perDay = days.map(d => sold.filter(o => new Date(o.date).toDateString() === d.toDateString()).reduce((a, o) => a + o.total, 0));
  const max = Math.max(1, ...perDay);

  const byCustomer = {};
  orders.filter(o => o.status !== 'Cancelled').forEach(o => { const k = o.userEmail || o.customer.phone; byCustomer[k] = (byCustomer[k] || 0) + 1; });
  const customers = Object.keys(byCustomer).length;
  const repeat = Object.values(byCustomer).filter(n => n > 1).length;

  const statusCount = Object.fromEntries(['Awaiting payment', 'Payment sent', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(s => [s, orders.filter(o => o.status === s).length]));
  const low = Store.data.products.filter(p => p.qty <= Store.data.settings.lowStockAt).sort((a, b) => a.qty - b.qty);
  const all = Store.reviews('all');
  const avg = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0;

  return (
    <div className="analytics">
      <div className="stats four">
        <div className="card stat"><b>{money(revenue)}</b><small>Revenue (confirmed)</small></div>
        <div className="card stat"><b>{sold.length}</b><small>Orders confirmed</small></div>
        <div className="card stat"><b>{money(sold.length ? Math.round(revenue / sold.length) : 0)}</b><small>Avg order value</small></div>
        <div className="card stat"><b>{money(pending)}</b><small>Awaiting confirmation</small></div>
      </div>

      <section className="card">
        <h2>Revenue, last 14 days</h2>
        <div className="bars" role="img" aria-label="Daily revenue for the last 14 days">
          {perDay.map((v, k) => (
            <div key={k} className="bar" title={`${days[k].toLocaleDateString()}: ${money(v)}`}>
              <i style={{ height: `${(v / max) * 100}%` }} />
              <small>{days[k].getDate()}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Best sellers</h2>
          {topList.length ? topList.map(t => (
            <div className="rowlink static" key={t.name}><span>{t.name}</span><span className="muted">{t.qty} sold · {money(t.rev)}</span></div>
          )) : <p className="muted">No confirmed sales yet.</p>}
        </section>
        <section className="card">
          <h2>Customers & feedback</h2>
          <div className="rowlink static"><span>Customers</span><b>{customers}</b></div>
          <div className="rowlink static"><span>Repeat customers</span><b>{repeat}</b></div>
          <div className="rowlink static"><span>Average rating</span><b>{avg ? avg.toFixed(1) + ' ★' : '–'} <small className="muted">({all.length})</small></b></div>
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Orders by status</h2>
          {Object.entries(statusCount).map(([k, v]) => <div className="rowlink static" key={k}><span>{k}</span><b>{v}</b></div>)}
        </section>
        <section className="card">
          <h2>Restock soon</h2>
          {low.length ? low.map(p => <div className="rowlink static" key={p.id}><span>{p.name}</span><b className={p.qty === 0 ? 'out' : 'low'}>{p.qty === 0 ? 'Sold out' : `${p.qty} left`}</b></div>) : <p className="muted">Stock looks healthy 👍</p>}
        </section>
      </div>
      {!REMOTE && <p className="muted small">Based on orders on this device. Connect the backend to see every customer order here.</p>}
    </div>
  );
}

/* ---------- Backup ---------- */
function Backup() {
  const ref = useRef();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const info = Store.backupInfo;
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
    a.download = 'ddtreasure-catalog.json'; a.click();
  };
  const backupNow = async () => {
    setBusy(true);
    try { const r = await api.backupNow(await getToken()); Store.setBackup({ last: r.at }); toast('Backed up to Drive ✓'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <>
      {REMOTE && (
        <section className="card form">
          <h2>Automatic Drive backup</h2>
          <p style={{ margin: 0 }}><span className={`pill ${info.auto ? 'confirmed' : 'cancelled'}`}>{info.auto ? 'Daily backup is ON' : 'Daily backup is OFF'}</span></p>
          <p className="muted" style={{ margin: 0 }}>
            Last backup: <b>{info.last ? new Date(info.last).toLocaleString() : 'none yet'}</b>. Your products, orders, reviews and coupons are copied
            into <b>DDTreasure26-Data → backups</b> in your Drive, one folder per day, and the newest 30 days are kept.
          </p>
          {!info.auto && (
            <ol className="steps small">
              <li>Open your Apps Script project.</li>
              <li>In the toolbar choose the function <b>setupDailyBackup</b> and click <b>Run</b> (approve the permission once).</li>
              <li>Then <b>Deploy → Manage deployments → ✏ → New version → Deploy</b>, and refresh this page.</li>
            </ol>
          )}
          <button className="btn" disabled={busy} onClick={backupNow}>{busy ? 'Backing up…' : 'Back up to Drive now'}</button>
        </section>
      )}
      <section className="card form">
        <h2>Copy &amp; restore</h2>
        <p className="muted" style={{ margin: 0 }}>Download a copy of your catalog to keep on your computer, or restore one from a file.</p>
        <div className="row">
          <button className="btn" onClick={download}>Download copy</button>
          {REMOTE && <button className="btn ghost" onClick={() => save()}>Publish to Drive now</button>}
          <button className="btn ghost" onClick={() => ref.current.click()}>Restore from file</button>
          <button className="btn ghost danger" onClick={() => { if (confirm('Reset everything to the sample data?')) { Store.reset(); save(); } }}>Reset to sample</button>
        </div>
        <input ref={ref} hidden type="file" accept="application/json" onChange={async e => {
          try { Store.importJSON(await e.target.files[0].text()); toast('Restored ✓'); } catch (err) { toast(err.message); }
          e.target.value = '';
        }} />
      </section>
    </>
  );
}

/* ---------- Reviews ---------- */
function AdminReviews() {
  const [f, setF] = useState({ productId: '', name: '', rating: 5, text: '' });
  const { reviews, products } = Store.data;
  const pname = id => products.find(p => p.id === id)?.name || 'General';
  return (
    <>
      <form className="card form" onSubmit={e => {
        e.preventDefault();
        Store.addReview({ productId: f.productId || null, name: f.name.trim(), rating: Number(f.rating), text: f.text.trim() });
        setF({ ...f, name: '', text: '' }); save('reviews');
      }}>
        <b>Add a review (e.g. one sent on WhatsApp / Instagram)</b>
        <select value={f.productId} onChange={e => setF({ ...f, productId: e.target.value })}>
          <option value="">General shop review</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="two">
          <input required placeholder="Customer name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <select value={f.rating} onChange={e => setF({ ...f, rating: e.target.value })}>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
          </select>
        </div>
        <textarea required rows={3} placeholder="Review text" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        <button className="btn">Add review</button>
      </form>
      {reviews.map(r => (
        <div className="card order" key={r.id}>
          <div className="row between"><b>{r.name}</b><Stars value={r.rating} /></div>
          <small className="muted">{pname(r.productId)} · {new Date(r.date).toLocaleDateString()}{r.pending ? ' · awaiting approval' : r.visible ? '' : ' · hidden'}{r.verified ? ' · ✓ verified buyer' : ''}</small>
          <p style={{ margin: 0 }}>{r.text}</p>
          <div className="row">
            <button className="btn ghost small" onClick={() => { r.visible = !r.visible; r.pending = false; save('reviews'); }}>{r.pending ? 'Approve' : r.visible ? 'Hide' : 'Show'}</button>
            <button className="btn ghost small danger" onClick={() => { if (confirm('Delete this review?')) { Store.data.reviews = reviews.filter(x => x.id !== r.id); save('reviews'); } }}>Delete</button>
          </div>
        </div>
      ))}
      {!reviews.length && <div className="empty">No reviews yet.</div>}
    </>
  );
}

/* ---------- Coupons ---------- */
const blankCoupon = () => ({ code: '', type: 'percent', value: '', minOrder: '', maxDiscount: '', expires: '', limit: '', active: true });
const describeCoupon = c =>
  `${c.type === 'percent' ? `${c.value}% off` : `${money(c.value)} off`}` +
  (c.type === 'percent' && c.maxDiscount > 0 ? ` (max ${money(c.maxDiscount)})` : '') +
  (c.minOrder > 0 ? ` · min order ${money(c.minOrder)}` : '') +
  (c.expires ? ` · until ${c.expires}` : '');

function Coupons() {
  const list = Store.adminCoupons;
  const [f, setF] = useState(blankCoupon());
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  if (!REMOTE) return <div className="notice">Coupons need the Drive backend (they are checked on the server so customers cannot fake them).</div>;

  const persist = async next => {
    Store.setCoupons(next);
    const ok = await Store.commit('coupons');
    toast(ok ? 'Coupons saved ✓' : (Store.lastError || 'Could not save coupons'));
    if (!ok) await Store.loadAdminData().catch(() => {});
  };
  const add = e => {
    e.preventDefault();
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 3) return toast('Use at least 3 letters or digits for the code');
    if (list.some(c => c.code === code)) return toast('That code already exists');
    persist([{ ...f, code, value: Number(f.value), minOrder: Number(f.minOrder) || 0, maxDiscount: Number(f.maxDiscount) || 0, limit: Math.floor(Number(f.limit)) || 0, used: 0, usedBy: [] }, ...list]);
    setF(blankCoupon());
  };

  return (
    <>
      <form className="card form" onSubmit={add}>
        <h2>New coupon</h2>
        <div className="two">
          <label>Code<input required minLength={3} maxLength={20} placeholder="DIWALI10" value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
          <label>Type
            <select value={f.type} onChange={set('type')}>
              <option value="percent">Percent off</option>
              <option value="flat">Flat ₹ off</option>
            </select>
          </label>
        </div>
        <div className="two">
          <label>{f.type === 'percent' ? 'Percent (1–100)' : 'Amount (₹)'}<input required type="number" min="1" max={f.type === 'percent' ? 100 : undefined} value={f.value} onChange={set('value')} /></label>
          <label>Minimum order (₹)<input type="number" min="0" placeholder="0 = none" value={f.minOrder} onChange={set('minOrder')} /></label>
        </div>
        <div className="two">
          {f.type === 'percent'
            ? <label>Maximum discount (₹)<input type="number" min="0" placeholder="0 = no cap" value={f.maxDiscount} onChange={set('maxDiscount')} /></label>
            : <span />}
          <label>Total uses allowed<input type="number" min="0" placeholder="0 = unlimited" value={f.limit} onChange={set('limit')} /></label>
        </div>
        <label>Expires on (optional)<input type="date" value={f.expires} onChange={set('expires')} /></label>
        <p className="muted small" style={{ margin: 0 }}>Each customer can use a code once. Discounts apply to the items only, not courier or gift wrap. Cancelled orders give the code back.</p>
        <button className="btn">Add coupon</button>
      </form>

      {list.map(c => (
        <div className="card order" key={c.code}>
          <div className="row between">
            <b className="code">{c.code}</b>
            <span className={`pill ${c.active ? 'confirmed' : 'cancelled'}`}>{c.active ? 'Active' : 'Paused'}</span>
          </div>
          <span>{describeCoupon(c)}</span>
          <small className="muted">Used {c.used || 0}{c.limit > 0 ? ` of ${c.limit}` : ''} time(s)</small>
          <div className="row">
            <button className="btn small ghost" onClick={() => persist(list.map(x => x.code === c.code ? { ...x, active: !x.active } : x))}>{c.active ? 'Pause' : 'Activate'}</button>
            <button className="btn small ghost danger" onClick={() => { if (confirm(`Delete coupon ${c.code}?`)) persist(list.filter(x => x.code !== c.code)); }}>Delete</button>
          </div>
        </div>
      ))}
      {!list.length && <div className="empty">No coupons yet.</div>}
    </>
  );
}
