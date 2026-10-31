import { API_URL } from './config';

export const REMOTE = Boolean(API_URL);

async function parse(res) {
  let data;
  try { data = await res.json(); } catch { throw new Error('The server did not respond properly. Please try again.'); }
  if (!data.ok) throw Object.assign(new Error(data.error || 'Request failed'), { code: data.code });
  return data;
}

// Plain-text body keeps this a "simple" cross-origin request (Apps Script cannot answer CORS preflights).
const post = (action, token, payload = {}) =>
  fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, token, ...payload }) }).then(parse);

export const api = {
  catalog: () => fetch(`${API_URL}?action=catalog`).then(parse),
  placeOrder: (t, order) => post('placeOrder', t, order),
  myOrders: t => post('myOrders', t),
  markPaymentSent: (t, id) => post('markPaymentSent', t, { id }),
  cancelOrder: (t, id) => post('cancelOrder', t, { id }),
  addReview: (t, review) => post('addReview', t, review),
  adminData: t => post('adminData', t),
  checkCoupon: (t, items, code) => post('checkCoupon', t, { items, code }),
  saveCoupons: (t, coupons) => post('saveCoupons', t, { coupons }),
  saveCatalog: (t, catalog) => post('saveCatalog', t, { catalog }),
  saveReviews: (t, reviews) => post('saveReviews', t, { reviews }),
  uploadImage: (t, dataUrl) => post('uploadImage', t, { dataUrl }),
  updateOrder: (t, id, patch) => post('updateOrder', t, { id, ...patch })
};
