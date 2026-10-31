import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { REMOTE, api } from '../api';
import { Store, fileToDataURL, money, useStore } from '../store';
import { ADMIN_EMAIL } from '../config';
import { Stars, notify, toast, Img } from '../ui';
import { GoogleButton, useAuth } from '../auth';

const TABS = [['products', '🛍️ Products'], ['categories', '🗂️ Categories'], ['home', '🏠 Home & promos'], ['shop', '🏪 Shop details'], ['courier', '📮 Courier'], ['orders', '📦 Orders'], ['analytics', '📊 Analytics'], ['reviews', '⭐ Reviews'], ['data', '💾 Backup']];

const save = async scope => {
  const ok = await Store.commit(scope);
  toast(ok ? (REMOTE ? 'Saved & published ✓' : 'Saved ✓') : (Store.lastError || 'Storage full – use smaller/fewer images'));
};

export default function Admin() {
  useStore();
  const auth = useAuth();
  const [ok, setOk] = useState(() => sessionStorage.getItem('ddt.admin') === '1');
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('products');
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

  return (
    <div className="admin">
      <div className="row between">
        <h1>Admin</h1>
        <button className="btn ghost small" onClick={() => { sessionStorage.removeItem('ddt.admin'); setOk(false); auth.signOut(); }}>Log out</button>
      </div>
      <div className="stats four">
        <div className="card stat"><b>{Store.data.products.length}</b><small>Products</small></div>
        <div className="card stat"><b>{Store.data.products.filter(p => p.qty <= Store.data.settings.lowStockAt).length}</b><small>Low / out of stock</small></div>
        <div className="card stat"><b>{(REMOTE ? Store.adminOrders : Store.orders()).filter(o => o.status === 'Awaiting payment' || o.status === 'Payment sent').length}</b><small>Open orders</small></div>
        <div className="card stat"><b>{Store.reviews('all').length}</b><small>Reviews</small></div>
      </div>
      {REMOTE && !Store.published && (
        <div className="notice">
          Your shop is empty online, so customers see nothing yet. Add products, or publish the starter samples to begin.{' '}
          <button className="btn small" onClick={async () => { Store.reset(); await save(); }}>Publish starter products</button>
        </div>
      )}
      <div className="chips">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'products' && <Products />}
      {tab === 'categories' && <Categories />}
      {tab === 'home' && <HomeSettings />}
      {tab === 'shop' && <ShopSettings />}
      {tab === 'courier' && <Courier />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'reviews' && <AdminReviews />}
      {tab === 'data' && <Backup />}
    </div>
  );
}

/* ---------- Products ---------- */
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
  const [p, setP] = useState(init);
  const set = k => ev => setP({ ...p, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const addImgs = async ev => {
    const urls = await Promise.all([...ev.target.files].map(f => fileToDataURL(f)));
    setP(x => ({ ...x, images: [...x.images, ...urls] }));
    ev.target.value = '';
  };
  const submit = ev => {
    ev.preventDefault();
    const clean = { ...p, id: p.id || Store.uid(), createdAt: p.createdAt || Date.now(), price: Number(p.price), offerPrice: Number(p.offerPrice) || 0, qty: Math.max(0, parseInt(p.qty) || 0) };
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
    <div className="row">
      <label className="grow">Courier charge ₹ (confirm with customer)<input type="number" min="0" value={v} onChange={e => setV(e.target.value)} /></label>
      <button className="btn small ghost" onClick={() => onSave(Number(v))}>Update</button>
    </div>
  );
}

function AdminOrders() {
  const { getToken } = useAuth();
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
        ...x, ...p, ...(p.courierCharge != null ? { total: x.subtotal + p.courierCharge + (x.giftFee || 0) } : {})
      }));
      return;
    }
    try {
      const r = await api.updateOrder(await getToken(), o.id, p);
      Store.applyAdminOrder(r.order, r.products);
      toast(p.status === 'Confirmed' ? 'Confirmed – stock updated, customer emailed ✓' : 'Updated ✓');
    } catch (e) { toast(e.message); }
  };

  return (
    <>
      <div className="row between">
        <p className="muted small" style={{ margin: 0 }}>
          {REMOTE ? 'Live from Drive. Confirming an order reduces stock and emails the customer.' : 'Orders placed on this device (connect the backend to receive customers\' orders here).'}
        </p>
        {REMOTE && <button className="btn small ghost" onClick={() => Store.loadAdminData().then(() => toast('Refreshed')).catch(e => toast(e.message))}>Refresh</button>}
      </div>
      {orders.map(o => (
        <div className="card order" key={o.id}>
          <div className="row between"><b>{o.id}</b><b>{money(o.total)}</b></div>
          <small className="muted">
            {o.customer.name} · {o.customer.phone}{o.userEmail ? ` · ${o.userEmail}` : ''}
            {o.mode === 'courier' ? ` · ${o.customer.address}, ${o.customer.city} ${o.customer.pin}` : ' · pickup'}
          </small>
          <ul>{o.items.map((i, k) => <li key={k}>{i.name} × {i.qty}</li>)}</ul>
          {o.giftWrap && <p className="notice small">🎁 Gift wrap{o.giftMessage ? `: “${o.giftMessage}”` : ''}</p>}
          {o.customer.note && <small className="muted">Note: {o.customer.note}</small>}
          {o.mode === 'courier' && <ChargeEditor key={o.courierCharge} o={o} onSave={c => patch(o, { courierCharge: c })} />}
          <div className="row">
            <select className="grow" value={o.status} onChange={e => patch(o, { status: e.target.value })}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <Link className="btn small ghost" to={`/invoice/${o.id}`}>Invoice</Link>
          </div>
        </div>
      ))}
      {!orders.length && <div className="empty">No orders yet.</div>}
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
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
    a.download = 'ddtreasure-catalog.json'; a.click();
  };
  return (
    <div className="card form">
      <h2>Backup &amp; restore</h2>
      <p className="muted">Data is stored in this browser for now. Download a backup regularly; Google Drive sync ({ADMIN_EMAIL}) replaces this in the next step.</p>
      <div className="row">
        <button className="btn" onClick={download}>Download backup</button>
        {REMOTE && <button className="btn ghost" onClick={() => save()}>Publish to Drive now</button>}
        <button className="btn ghost" onClick={() => ref.current.click()}>Restore from file</button>
        <button className="btn ghost danger" onClick={() => { if (confirm('Reset everything to the sample data?')) { Store.reset(); save(); } }}>Reset to sample</button>
      </div>
      <input ref={ref} hidden type="file" accept="application/json" onChange={async e => {
        try { Store.importJSON(await e.target.files[0].text()); toast('Restored ✓'); } catch (err) { toast(err.message); }
        e.target.value = '';
      }} />
    </div>
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
          <small className="muted">{pname(r.productId)} · {new Date(r.date).toLocaleDateString()}{r.visible ? '' : ' · hidden'}</small>
          <p style={{ margin: 0 }}>{r.text}</p>
          <div className="row">
            <button className="btn ghost small" onClick={() => { r.visible = !r.visible; save('reviews'); }}>{r.visible ? 'Hide' : 'Show'}</button>
            <button className="btn ghost small danger" onClick={() => { if (confirm('Delete this review?')) { Store.data.reviews = reviews.filter(x => x.id !== r.id); save('reviews'); } }}>Delete</button>
          </div>
        </div>
      ))}
      {!reviews.length && <div className="empty">No reviews yet.</div>}
    </>
  );
}
