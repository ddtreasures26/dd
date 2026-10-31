/* Data layer. All reads/writes go through here so the backing storage can be
   swapped for Google Drive (see `adapter`) without touching the UI. */
import { useEffect, useState } from 'react';
import { ADMIN_EMAIL } from './config';
import { REMOTE, api } from './api';

const KEY = 'ddt.catalog.v1';
const ORDERS = 'ddt.orders.v1';
const CART = 'ddt.cart.v1';
const RECENT = 'ddt.recent.v1';
const PREFS = 'ddt.prefs.v1';

export const art = (emoji, a, b) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="240" font-size="150" text-anchor="middle">${emoji}</text></svg>`);

const seed = () => ({
  settings: {
    shopName: 'DD_Treasure26',
    tagline: 'Handmade with love',
    logo: 'assets/logo.png',
    about: 'DD_Treasure26 is a tiny handmade studio of two sisters. Every pearl, bow and charm is picked and strung by hand, so each piece carries a little bit of love.',
    address: 'Add your address here',
    mapInput: '',
    phone: '+91 00000 00000',
    whatsapp: '910000000000',
    email: ADMIN_EMAIL,
    instagram: 'https://instagram.com/dd_treasure26',
    upiId: '',
    qrImage: '',
    promoVideo: '',
    adminPin: '1234',
    lowStockAt: 10,
    giftWrapFee: 30,
    banners: [
      { title: 'Handmade with love', text: 'Pearls, charms & little treasures', image: art('💍', '#fde4ea', '#f6c1cf') },
      { title: 'Festive offers', text: 'Up to 20% off on selected sets', image: art('🎀', '#fbe8d3', '#f0c39a') },
      { title: 'New arrivals', text: 'Fresh pearl collection just landed', image: art('📿', '#f6e3ef', '#e7b9d3') }
    ],
    courier: [
      { name: 'Within city', charge: 40 },
      { name: 'Within state', charge: 70 },
      { name: 'Other states', charge: 110 },
      { name: 'Remote / islands', charge: 150 }
    ]
  },
  reviews: [
    { id: 'r1', productId: 'p1', name: 'Anika', rating: 5, text: 'Beautiful and exactly like the pictures. Packed so nicely!', date: '2026-09-12T10:00:00Z', visible: true },
    { id: 'r2', productId: null, name: 'Meera', rating: 5, text: 'Lovely handmade pieces and very friendly sisters. Will order again.', date: '2026-09-20T10:00:00Z', visible: true }
  ],
  categories: ['Necklaces', 'Bracelets', 'Earrings', 'Rings', 'Hair accessories'],
  products: [
    { id: 'p1', createdAt: Date.now() - 2 * 864e5, name: 'Pearl Heart Necklace', category: 'Necklaces', price: 349, offerPrice: 299, qty: 12, offer: true, images: [art('📿', '#fff1e6', '#f6c1cf')], description: 'Freshwater-look pearls with a tiny heart charm. Adjustable length.' },
    { id: 'p2', createdAt: Date.now() - 6 * 864e5, name: 'Pink Bow Hair Clip', category: 'Hair accessories', price: 129, offerPrice: 0, qty: 8, offer: false, images: [art('🎀', '#ffe3ec', '#f4a6bd')], description: 'Soft satin bow on a strong metal clip.' },
    { id: 'p3', name: 'Pearl Charm Bracelet', category: 'Bracelets', price: 249, offerPrice: 0, qty: 20, offer: false, images: [art('🤍', '#f7ede2', '#e9d3b8')], options: [{ name: 'Size', values: ['S', 'M', 'L'] }], description: 'Beaded bracelet with a dainty charm and gold-tone clasp.' },
    { id: 'p4', name: 'Sparkle Ring Set', category: 'Rings', price: 399, offerPrice: 349, qty: 5, offer: true, images: [art('💍', '#fdeccf', '#f1c27d')], options: [{ name: 'Ring size', values: ['6', '7', '8', '9', '10'] }], description: 'Set of three stackable rings with a crystal accent.' },
    { id: 'p5', createdAt: Date.now() - 20 * 864e5, name: 'Pearl Drop Earrings', category: 'Earrings', price: 199, offerPrice: 0, qty: 30, offer: false, images: [art('✨', '#fbe9f1', '#eab7cf')], description: 'Lightweight pearl drops, hypoallergenic hooks.' },
    { id: 'p6', name: 'Rose Gold Charm Bracelet', category: 'Bracelets', price: 299, offerPrice: 0, qty: 0, offer: false, images: [art('🌸', '#fde7e0', '#f2b5a4')], description: 'Currently sold out – ask on WhatsApp for a custom order.' }
  ]
});

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// Swap for a Google Drive implementation later (same two functions).
export const adapter = { load: () => read(KEY, null), save: d => write(KEY, d) };

let data = adapter.load();
// With a backend, customers must never see sample products: start empty until the real catalog loads.
const emptyCatalog = () => ({ settings: seed().settings, categories: [], products: [], reviews: [] });
if (!data) { data = REMOTE ? emptyCatalog() : seed(); adapter.save(data); }
data.settings = { ...seed().settings, ...data.settings };
data.reviews ||= [];

let status = REMOTE ? 'loading' : 'ready'; // loading | ready | error
let published = !REMOTE; // has the admin ever published a catalog to Drive?
let lastError = '';
let adminOrders = [];
let adminCoupons = [];
let backupInfo = { last: '', auto: false };
let tokenGetter = async () => { throw new Error('Please sign in.'); };

const isInlineImage = v => typeof v === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(v);

/** Upload any photos still stored inline (data URLs) to Drive and swap in their URLs. */
async function uploadPending(token) {
  const jobs = [];
  const add = (obj, key) => { if (isInlineImage(obj[key])) jobs.push([obj, key]); };
  data.products.forEach(p => (p.images || []).forEach((_, i) => add(p.images, i)));
  add(data.settings, 'logo');
  add(data.settings, 'qrImage');
  (data.settings.banners || []).forEach(b => add(b, 'image'));
  for (const [obj, key] of jobs) obj[key] = (await api.uploadImage(token, obj[key])).url;
}

const bus = new EventTarget();
const emit = () => bus.dispatchEvent(new Event('change'));

/** Re-render the calling component whenever the store changes. */
export function useStore() {
  const [, setN] = useState(0);
  useEffect(() => {
    const h = () => setN(n => n + 1);
    bus.addEventListener('change', h);
    return () => bus.removeEventListener('change', h);
  }, []);
  return Store;
}

export const Store = {
  get data() { return data; },
  get status() { return status; },
  get published() { return published; },
  get lastError() { return lastError; },
  get adminOrders() { return adminOrders; },
  get adminCoupons() { return adminCoupons; },
  get backupInfo() { return backupInfo; },
  setBackup(info) { backupInfo = { ...backupInfo, ...info }; emit(); },
  setCoupons(list) { adminCoupons = list; emit(); },
  setTokenGetter(fn) { tokenGetter = fn; },
  setReviews(list) { data.reviews = list; Store.persist(); },

  /** Save to this browser only. Returns false if browser storage is full. */
  persist() { const ok = adapter.save(data); emit(); return ok; },

  /** Save locally and, when a backend is configured, publish to Drive (admin only). Resolves true on success. */
  async commit(scope = 'catalog') {
    const ok = Store.persist();
    if (!REMOTE) return ok;
    lastError = '';
    try {
      const token = await tokenGetter();
      if (scope === 'coupons') adminCoupons = (await api.saveCoupons(token, adminCoupons)).coupons;
      else if (scope === 'reviews') await api.saveReviews(token, data.reviews);
      else {
        await uploadPending(token);
        Store.persist();
        const { adminPin, ...settings } = data.settings;
        await api.saveCatalog(token, { settings, categories: data.categories, products: data.products });
        published = true;
      }
      return true;
    } catch (e) { lastError = e.message; return false; }
  },

  /** Fetch the shared catalog (products, settings, visible reviews). */
  async refresh() {
    if (!REMOTE) return;
    try {
      const d = await api.catalog();
      if (d.catalog?.updated) {
        data = {
          settings: { ...seed().settings, ...d.catalog.settings },
          categories: d.catalog.categories || [],
          products: d.catalog.products || [],
          reviews: d.reviews || []
        };
        published = true;
      } else { published = false; data.reviews = d.reviews || []; }
      status = 'ready';
      adapter.save(data);
    } catch { status = data.products.length ? 'ready' : 'error'; }
    emit();
  },

  /** Admin: load every order and every review (including hidden ones). */
  async loadAdminData() {
    const d = await api.adminData(await tokenGetter());
    adminOrders = d.orders;
    adminCoupons = d.coupons || [];
    backupInfo = { last: d.lastBackup || '', auto: !!d.autoBackup };
    data.reviews = d.reviews;
    Store.persist();
    return d.orders;
  },
  applyAdminOrder(order, products = []) {
    adminOrders = adminOrders.map(o => (o.id === order.id ? order : o));
    products.forEach(({ id, qty }) => { const p = data.products.find(x => x.id === id); if (p) p.qty = qty; });
    Store.persist();
  },
  upsertOrder(order) { Store.setOrders([order, ...Store.orders().filter(x => x.id !== order.id)]); },
  /** Replace this customer's cached orders with the server's copy. */
  syncMyOrders(list, email) { Store.setOrders([...list, ...Store.orders().filter(o => (o.userEmail || '') !== email)]); },
  reset() { data = seed(); adapter.save(data); emit(); },
  exportJSON: () => JSON.stringify(data, null, 2),
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d.products || !d.settings) throw new Error('Not a DD_Treasure26 catalog file');
    data = { ...d, reviews: d.reviews || [], settings: { ...seed().settings, ...d.settings } };
    Store.commit();
  },
  product: id => data.products.find(p => p.id === id),
  price: p => (p.offer && p.offerPrice > 0 ? p.offerPrice : p.price),
  uid: () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),

  /** visible reviews; productId null = general shop reviews, 'all' = everything */
  reviews: (productId = 'all') => data.reviews
    .filter(r => r.visible && (productId === 'all' || (r.productId || null) === productId))
    .sort((a, b) => b.date.localeCompare(a.date)),
  rating(productId) {
    const l = Store.reviews(productId);
    return { n: l.length, avg: l.length ? l.reduce((a, r) => a + r.rating, 0) / l.length : 0 };
  },
  addReview(r) {
    data.reviews.unshift({ id: 'r' + Date.now().toString(36), date: new Date().toISOString(), visible: true, ...r });
    return Store.persist();
  },

  cart: () => read(CART, []), // [{id, qty, sel, label}]
  setCart(c) { write(CART, c); emit(); },
  /** sel = chosen options, e.g. { 'Ring size': '7' }. Stock is shared by every option of a product. */
  addToCart(id, n = 1, sel = {}) {
    const p = Store.product(id); if (!p) return false;
    const label = variantLabel(p, sel);
    const c = Store.cart();
    const others = c.filter(l => l.id === id && (l.label || '') !== label).reduce((a, l) => a + l.qty, 0);
    const line = c.find(l => l.id === id && (l.label || '') === label);
    const next = Math.min(p.qty - others, (line?.qty || 0) + n);
    if (next <= 0) return false;
    if (line) line.qty = next; else c.push({ id, qty: next, sel, label });
    Store.setCart(c); return true;
  },

  orders: () => read(ORDERS, []), // kept on this device = "my orders"
  setOrders(o) { write(ORDERS, o); emit(); },
  nextOrderId() {
    const d = new Date();
    const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return `DDT-${ymd}-${String(Store.orders().filter(o => o.id.includes(ymd)).length + 1).padStart(3, '0')}`;
  },

  recent: () => read(RECENT, []),
  addRecent(id) { write(RECENT, [id, ...Store.recent().filter(x => x !== id)].slice(0, 10)); },

  /** Saved delivery details, per signed-in email (or 'guest'). */
  profile: key => ({ phone: '', address: '', city: '', pin: '', ...(read('ddt.profile.v1', {})[key || 'guest'] || {}) }),
  setProfile(key, p) { write('ddt.profile.v1', { ...read('ddt.profile.v1', {}), [key || 'guest']: p }); emit(); },

  prefs: () => ({ theme: 'auto', notify: false, ...read(PREFS, {}) }),
  setPrefs(p) { write(PREFS, { ...Store.prefs(), ...p }); emit(); }
};

/** Shrink an uploaded image to a small JPEG data URL (keeps storage small). */
export function fileToDataURL(file, max = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/** "Ring size: 7, Colour: Gold" for the chosen options of a product ('' when it has none). */
export const variantLabel = (p, sel) => (p.options || []).map(g => `${g.name}: ${sel?.[g.name]}`).join(', ');
export const cartKey = l => `${l.id}|${l.label || ''}`;

/** Rupees with Indian digit grouping: ₹1,23,456 (paise only when present). */
export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Google Drive file id from any Drive image link we may have stored, else null. */
export const driveId = url => (typeof url === 'string' && url.match(/drive\.google\.com\/(?:thumbnail|uc)\?[^#]*?\bid=([\w-]+)/)?.[1]) || null;

/** Direct, CDN-served image URL at roughly the requested width (works for photos already published). */
export const imgUrl = (url, w = 600) => {
  const id = driveId(url);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w${w}` : url;
};
