/**
 * DD_Treasure26 backend: a Google Apps Script web app.
 * Runs as the shop's Google account, keeps all data in the Drive folder
 * "DDTreasure26-Data" (catalog.json, reviews.json, orders.json, images/),
 * verifies Google sign-in tokens, and emails customers/admin on order updates.
 * Setup: see backend/README.md
 */
const CLIENT_ID = '566285685011-uok9mas25n93gjm55vmcdk23aq7bpcsg.apps.googleusercontent.com';
const ADMIN_EMAIL = 'ddtreasures26@gmail.com';
const SHOP_NAME = 'DD_Treasure26';
const SHOP_URL = 'https://dd.ddtreasures26.workers.dev/';
const FOLDER_NAME = 'DDTreasure26-Data';
const TZ = 'Asia/Kolkata';
const STATUSES = ['Awaiting payment', 'Payment sent', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const STOCK_STATUSES = ['Confirmed', 'Shipped', 'Delivered']; // statuses that hold stock

/* ---------- entry points ---------- */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'catalog') return json_(publicData_());
    return json_({ ok: true, service: SHOP_NAME });
  } catch (err) { return json_(errOut_(err)); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const act = ACTIONS[body.action];
    if (!act) throw fail_('bad_request', 'Unknown action');
    const user = act.auth ? auth_(body.token) : null;
    if (act.admin && user.email !== ADMIN_EMAIL.toLowerCase()) throw fail_('forbidden', 'Admin only');
    let lock = null;
    if (act.write) { lock = LockService.getScriptLock(); lock.waitLock(25000); }
    try {
      return json_(Object.assign({ ok: true }, act.run(user, body)));
    } finally { if (lock) lock.releaseLock(); }
  } catch (err) { return json_(errOut_(err)); }
}

/* ---------- helpers ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code, msg) { const e = new Error(msg); e.code = code; return e; }
function errOut_(err) {
  return { ok: false, code: err.code || 'server', error: err.code ? err.message : 'Something went wrong. Please try again.' };
}
function str_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function money_(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function folder_(sub) {
  const props = PropertiesService.getScriptProperties();
  let root = null;
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { root = DriveApp.getFolderById(id); } catch (e) { root = null; } }
  if (!root) {
    const it = DriveApp.getFoldersByName(FOLDER_NAME);
    root = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
    props.setProperty('FOLDER_ID', root.getId());
  }
  if (!sub) return root;
  const it = root.getFoldersByName(sub);
  return it.hasNext() ? it.next() : root.createFolder(sub);
}
function file_(name, initial) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILE_' + name);
  if (id) { try { return DriveApp.getFileById(id); } catch (e) { /* recreate below */ } }
  const root = folder_();
  const it = root.getFilesByName(name);
  const f = it.hasNext() ? it.next() : root.createFile(name, JSON.stringify(initial), MimeType.PLAIN_TEXT);
  props.setProperty('FILE_' + name, f.getId());
  return f;
}
function read_(name, initial) { return JSON.parse(file_(name, initial).getBlob().getDataAsString() || JSON.stringify(initial)); }
function write_(name, obj) { file_(name, obj).setContent(JSON.stringify(obj)); }
function bust_() { CacheService.getScriptCache().remove('public'); }

function publicData_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public');
  if (hit) return JSON.parse(hit);
  const out = {
    ok: true,
    catalog: read_('catalog.json', { updated: 0 }),
    reviews: read_('reviews.json', []).filter(function (r) { return r.visible; }).map(publicReview_)
  };
  try { cache.put('public', JSON.stringify(out), 300); } catch (e) { /* too big to cache */ }
  return out;
}
function publicReview_(r) {
  return { id: r.id, productId: r.productId || null, name: r.name, rating: r.rating, text: r.text, date: r.date, visible: true };
}

/** Verify a Google ID token and return {email, name}. */
function auth_(token) {
  if (!token) throw fail_('auth', 'Please sign in.');
  const cache = CacheService.getScriptCache();
  const key = 't' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw fail_('auth', 'Your session expired. Please sign in again.');
  const p = JSON.parse(r.getContentText());
  const verified = p.email_verified === true || p.email_verified === 'true';
  if (p.aud !== CLIENT_ID || !verified || !p.email) throw fail_('auth', 'Sign-in could not be verified.');
  const user = { email: String(p.email).toLowerCase(), name: p.name || p.email };
  const ttl = Math.max(1, Math.min(300, Number(p.exp) - Math.floor(Date.now() / 1000)));
  cache.put(key, JSON.stringify(user), ttl);
  return user;
}

function mail_(to, subject, html) {
  try { MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: SHOP_NAME }); } catch (e) { /* quota or invalid address */ }
}
function itemsHtml_(o) {
  return '<ul>' + o.items.map(function (i) { return '<li>' + esc_(i.name) + ' × ' + i.qty + ' — ' + money_(i.price * i.qty) + '</li>'; }).join('') + '</ul>';
}
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function nextOrderId_(orders) {
  const ymd = Utilities.formatDate(new Date(), TZ, 'yyMMdd');
  const n = orders.filter(function (o) { return o.id.indexOf(ymd) >= 0; }).length + 1;
  return 'DDT-' + ymd + '-' + ('00' + n).slice(-3);
}
function totalOf_(o) { return o.subtotal + (o.courierCharge || 0) + (o.giftFee || 0); }

/* ---------- actions ---------- */
const ACTIONS = {
  /* customer */
  placeOrder: { auth: true, write: true, run: function (user, b) {
    const catalog = read_('catalog.json', { updated: 0 });
    const products = catalog.products || [];
    const settings = catalog.settings || {};
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) throw fail_('bad_request', 'Your cart is empty.');
    const items = [];
    let subtotal = 0;
    b.items.forEach(function (it) {
      const p = products.filter(function (x) { return x.id === it.id; })[0];
      const qty = Math.floor(Number(it.qty));
      if (!p || !(qty >= 1)) throw fail_('bad_request', 'A product in your cart is no longer available.');
      if (qty > (p.qty || 0)) throw fail_('stock', p.name + ': only ' + (p.qty || 0) + ' left.');
      const price = p.offer && p.offerPrice > 0 ? Number(p.offerPrice) : Number(p.price);
      items.push({ id: p.id, name: p.name, price: price, qty: qty });
      subtotal += price * qty;
    });
    const mode = b.mode === 'courier' ? 'courier' : 'pickup';
    const c = b.customer || {};
    const customer = { name: str_(c.name, 80), phone: str_(c.phone, 20), address: str_(c.address, 300), city: str_(c.city, 60), pin: str_(c.pin, 10), note: str_(c.note, 200) };
    if (!customer.name) throw fail_('bad_request', 'Please enter your name.');
    if (!/^\+?[\d\s-]{10,15}$/.test(customer.phone)) throw fail_('bad_request', 'Please enter a valid phone number.');
    let zone = '', charge = 0;
    if (mode === 'courier') {
      if (!customer.address || !customer.city || !customer.pin) throw fail_('bad_request', 'Please enter the full delivery address.');
      const z = (settings.courier || []).filter(function (x) { return x.name === b.courierZone; })[0];
      if (!z) throw fail_('bad_request', 'Please choose a delivery location.');
      zone = z.name; charge = Math.max(0, Math.round(Number(z.charge) || 0));
    }
    const giftWrap = !!b.giftWrap;
    const orders = read_('orders.json', []);
    const order = {
      id: nextOrderId_(orders), date: new Date().toISOString(), items: items, subtotal: subtotal,
      mode: mode, courierZone: zone, courierCharge: charge,
      giftWrap: giftWrap, giftFee: giftWrap ? Math.max(0, Math.round(Number(settings.giftWrapFee) || 0)) : 0,
      giftMessage: str_(b.giftMessage, 300),
      userEmail: user.email, customer: customer, status: 'Awaiting payment', stockDeducted: false,
      history: [{ status: 'Awaiting payment', at: new Date().toISOString() }]
    };
    order.total = totalOf_(order);
    orders.unshift(order);
    write_('orders.json', orders);
    mail_(ADMIN_EMAIL, 'New order ' + order.id + ' (' + money_(order.total) + ')',
      '<p>' + esc_(customer.name) + ' (' + esc_(customer.phone) + ') placed an order.</p>' + itemsHtml_(order) +
      '<p>Total: <b>' + money_(order.total) + '</b>' + (mode === 'courier' ? ' (incl. estimated courier ' + money_(charge) + ')' : '') + '</p>' +
      '<p><a href="' + SHOP_URL + '#/admin">Open admin</a></p>');
    return { order: order };
  } },

  myOrders: { auth: true, run: function (user) {
    return { orders: read_('orders.json', []).filter(function (o) { return o.userEmail === user.email; }) };
  } },

  markPaymentSent: { auth: true, write: true, run: function (user, b) {
    const orders = read_('orders.json', []);
    const o = orders.filter(function (x) { return x.id === b.id && x.userEmail === user.email; })[0];
    if (!o) throw fail_('not_found', 'Order not found.');
    if (o.status === 'Awaiting payment') {
      o.status = 'Payment sent'; o.history.push({ status: o.status, at: new Date().toISOString() });
      write_('orders.json', orders);
      mail_(ADMIN_EMAIL, 'Payment sent for ' + o.id + ' (' + money_(o.total) + ')',
        '<p>' + esc_(o.customer.name) + ' says they paid ' + money_(o.total) + '. Check your UPI app, then confirm the order.</p><p><a href="' + SHOP_URL + '#/admin">Open admin</a></p>');
    }
    return { order: o };
  } },

  cancelOrder: { auth: true, write: true, run: function (user, b) {
    const orders = read_('orders.json', []);
    const o = orders.filter(function (x) { return x.id === b.id && x.userEmail === user.email; })[0];
    if (!o) throw fail_('not_found', 'Order not found.');
    if (o.status !== 'Awaiting payment') throw fail_('bad_request', 'This order can no longer be cancelled here. Please contact us.');
    o.status = 'Cancelled'; o.history.push({ status: o.status, at: new Date().toISOString() });
    write_('orders.json', orders);
    return { order: o };
  } },

  addReview: { auth: true, write: true, run: function (user, b) {
    const rating = Math.floor(Number(b.rating));
    const text = str_(b.text, 600);
    if (!(rating >= 1 && rating <= 5) || !text) throw fail_('bad_request', 'Please add a rating and a few words.');
    const pid = b.productId ? str_(b.productId, 40) : null;
    const reviews = read_('reviews.json', []);
    const mine = reviews.filter(function (r) { return r.email === user.email && (r.productId || null) === pid; })[0];
    const base = { productId: pid, name: str_(b.name, 40) || user.name, rating: rating, text: text, date: new Date().toISOString(), visible: true, email: user.email };
    if (mine) Object.assign(mine, base); else reviews.unshift(Object.assign({ id: 'r' + Date.now().toString(36) }, base));
    write_('reviews.json', reviews);
    bust_();
    return { reviews: reviews.filter(function (r) { return r.visible; }).map(publicReview_) };
  } },

  /* admin */
  adminData: { auth: true, admin: true, run: function () {
    return { orders: read_('orders.json', []), reviews: read_('reviews.json', []) };
  } },

  saveCatalog: { auth: true, admin: true, write: true, run: function (user, b) {
    const c = b.catalog || {};
    if (!Array.isArray(c.products) || !Array.isArray(c.categories) || typeof c.settings !== 'object') throw fail_('bad_request', 'Invalid catalog.');
    const settings = Object.assign({}, c.settings); delete settings.adminPin;
    const out = { updated: Date.now(), settings: settings, categories: c.categories, products: c.products };
    const text = JSON.stringify(out);
    if (text.length > 8 * 1024 * 1024) throw fail_('bad_request', 'Catalog is too large; use fewer inline images.');
    write_('catalog.json', out);
    bust_();
    return { updated: out.updated };
  } },

  saveReviews: { auth: true, admin: true, write: true, run: function (user, b) {
    if (!Array.isArray(b.reviews)) throw fail_('bad_request', 'Invalid reviews.');
    write_('reviews.json', b.reviews);
    bust_();
    return {};
  } },

  uploadImage: { auth: true, admin: true, run: function (user, b) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(b.dataUrl || ''));
    if (!m) throw fail_('bad_request', 'Not an image.');
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > 3 * 1024 * 1024) throw fail_('bad_request', 'Image is too large.');
    const ext = m[1].split('/')[1];
    const file = folder_('images').createFile(Utilities.newBlob(bytes, m[1], 'img-' + Date.now() + '.' + ext));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200' };
  } },

  updateOrder: { auth: true, admin: true, write: true, run: function (user, b) {
    const orders = read_('orders.json', []);
    const o = orders.filter(function (x) { return x.id === b.id; })[0];
    if (!o) throw fail_('not_found', 'Order not found.');
    let chargeChanged = false, products = null;

    if (b.courierCharge != null) {
      const c = Math.round(Number(b.courierCharge));
      if (o.mode !== 'courier' || !(c >= 0)) throw fail_('bad_request', 'Invalid courier charge.');
      chargeChanged = c !== o.courierCharge;
      o.courierCharge = c; o.total = totalOf_(o);
    }
    let statusChanged = false;
    if (b.status && b.status !== o.status) {
      if (STATUSES.indexOf(b.status) < 0) throw fail_('bad_request', 'Unknown status.');
      const holds = STOCK_STATUSES.indexOf(b.status) >= 0;
      if (holds !== !!o.stockDeducted) {
        const catalog = read_('catalog.json', { updated: 0 });
        const sign = holds ? -1 : 1;
        (catalog.products || []).forEach(function (p) {
          o.items.forEach(function (i) { if (i.id === p.id) p.qty = Math.max(0, (p.qty || 0) + sign * i.qty); });
        });
        catalog.updated = Date.now();
        write_('catalog.json', catalog);
        o.stockDeducted = holds;
        products = (catalog.products || []).map(function (p) { return { id: p.id, qty: p.qty }; });
        bust_();
      }
      o.status = b.status; statusChanged = true;
      o.history.push({ status: o.status, at: new Date().toISOString() });
    }
    write_('orders.json', orders);

    if (statusChanged || chargeChanged) {
      const link = '<p><a href="' + SHOP_URL + '#/order/' + o.id + '">View your order</a></p>';
      const msg = {
        'Payment sent': 'We have noted your payment and will confirm it shortly.',
        'Confirmed': 'Your order is confirmed. We are getting it ready with love.',
        'Shipped': 'Your order has been shipped.',
        'Delivered': 'Your order has been delivered. We hope you love it! Please leave us a review.',
        'Cancelled': 'Your order has been cancelled. Contact us if this was a mistake.'
      }[o.status] || '';
      mail_(o.userEmail, '[' + SHOP_NAME + '] Order ' + o.id + (statusChanged ? ' is ' + o.status : ' updated'),
        '<p>Hi ' + esc_(o.customer.name) + ',</p>' + (statusChanged ? '<p>' + msg + '</p>' : '') +
        (chargeChanged ? '<p>Courier charge confirmed: <b>' + money_(o.courierCharge) + '</b>. New total: <b>' + money_(o.total) + '</b>.</p>' : '') +
        itemsHtml_(o) + link + '<p>— ' + SHOP_NAME + '</p>');
    }
    return { order: o, products: products || [] };
  } }
};
