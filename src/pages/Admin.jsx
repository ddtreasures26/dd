import { useRef, useState } from 'react';
import { Store, fileToDataURL, money, useStore } from '../store';
import { ADMIN_EMAIL } from '../config';
import { Stars, toast } from '../ui';

const TABS = [['products', '🛍️ Products'], ['categories', '🗂️ Categories'], ['home', '🏠 Home & promos'], ['shop', '🏪 Shop details'], ['courier', '📮 Courier'], ['orders', '📦 Orders'], ['reviews', '⭐ Reviews'], ['data', '💾 Backup']];

const save = () => { if (!Store.commit()) toast('Storage full – use smaller/fewer images'); else toast('Saved ✓'); };

export default function Admin() {
  useStore();
  const [ok, setOk] = useState(() => sessionStorage.getItem('ddt.admin') === '1');
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('products');

  if (!ok) {
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

  return (
    <div className="admin">
      <div className="row between">
        <h1>Admin</h1>
        <button className="btn ghost small" onClick={() => { sessionStorage.removeItem('ddt.admin'); setOk(false); }}>Log out</button>
      </div>
      <div className="chips">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'products' && <Products />}
      {tab === 'categories' && <Categories />}
      {tab === 'home' && <HomeSettings />}
      {tab === 'shop' && <ShopSettings />}
      {tab === 'courier' && <Courier />}
      {tab === 'orders' && <AdminOrders />}
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
            <img src={p.images[0]} alt="" />
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
    const clean = { ...p, id: p.id || Store.uid(), price: Number(p.price), offerPrice: Number(p.offerPrice) || 0, qty: Math.max(0, parseInt(p.qty) || 0) };
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
          <span key={i} className="rm"><img src={s} alt="" /><button type="button" onClick={() => setP({ ...p, images: p.images.filter((_, k) => k !== i) })} aria-label="Remove photo">×</button></span>
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
      {value && <img src={value} alt="" />}
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
    <form className="card form" onSubmit={e => { e.preventDefault(); Object.assign(Store.data.settings, s, { lowStockAt: Number(s.lowStockAt) || 10 }); save(); }}>
      <ImageField label="Logo" value={s.logo} onChange={v => setS({ ...s, logo: v || 'assets/logo.png' })} max={512} />
      <label>Shop name<input value={s.shopName} onChange={set('shopName')} /></label>
      <label>Tagline<input value={s.tagline} onChange={set('tagline')} /></label>
      <label>About us<textarea rows={4} value={s.about} onChange={set('about')} /></label>
      <label>Address<textarea rows={2} value={s.address} onChange={set('address')} /></label>
      <label>Phone<input value={s.phone} onChange={set('phone')} /></label>
      <label>WhatsApp number (with country code, digits only)<input value={s.whatsapp} onChange={set('whatsapp')} inputMode="numeric" /></label>
      <label>Email<input value={s.email} onChange={set('email')} /></label>
      <label>Instagram link<input value={s.instagram} onChange={set('instagram')} /></label>
      <h2>Payment</h2>
      <label>UPI ID (optional, enables “Open UPI app”)<input value={s.upiId} onChange={set('upiId')} placeholder="name@bank" /></label>
      <ImageField label="GPay / UPI QR image" value={s.qrImage} onChange={v => setS({ ...s, qrImage: v })} max={700} />
      <h2>Other</h2>
      <label>Show “only N left” when stock is at or below<input type="number" min="1" value={s.lowStockAt} onChange={set('lowStockAt')} /></label>
      <label>Admin PIN<input value={s.adminPin} onChange={set('adminPin')} /></label>
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
function AdminOrders() {
  const orders = Store.orders();
  return (
    <>
      <p className="muted small">Shows orders placed on this device. Orders from customers arrive on WhatsApp; Drive sync will collect them here later.</p>
      {orders.map(o => (
        <div className="card order" key={o.id}>
          <div className="row between"><b>{o.id}</b><b>{money(o.total)}</b></div>
          <small className="muted">{o.customer.name} · {o.customer.phone}{o.mode === 'courier' ? ` · ${o.customer.address}, ${o.customer.city} ${o.customer.pin}` : ' · pickup'}</small>
          <ul>{o.items.map((i, k) => <li key={k}>{i.name} × {i.qty}</li>)}</ul>
          <select value={o.status} onChange={e => Store.setOrders(orders.map(x => x.id === o.id ? { ...x, status: e.target.value } : x))}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      ))}
      {!orders.length && <div className="empty">No orders yet.</div>}
    </>
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
        <button className="btn ghost" onClick={() => ref.current.click()}>Restore from file</button>
        <button className="btn ghost danger" onClick={() => confirm('Reset everything to the sample data?') && Store.reset()}>Reset to sample</button>
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
        setF({ ...f, name: '', text: '' }); toast('Review added');
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
            <button className="btn ghost small" onClick={() => { r.visible = !r.visible; save(); }}>{r.visible ? 'Hide' : 'Show'}</button>
            <button className="btn ghost small danger" onClick={() => { if (confirm('Delete this review?')) { Store.data.reviews = reviews.filter(x => x.id !== r.id); save(); } }}>Delete</button>
          </div>
        </div>
      ))}
      {!reviews.length && <div className="empty">No reviews yet.</div>}
    </>
  );
}
