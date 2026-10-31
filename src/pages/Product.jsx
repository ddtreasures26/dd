import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Store } from '../store';
import { Icon, Price, RatingSummary, Reviews, stockLabel, toast, waLink } from '../ui';

export default function Product() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = Store.product(id);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => { if (p) Store.addRecent(p.id); setImg(0); setQty(1); }, [id]);

  if (!p) return <div className="empty">Product not found. <Link to="/">Back to shop</Link></div>;
  const st = stockLabel(p);
  const inCart = Store.cart().find(l => l.id === p.id)?.qty || 0;
  const room = p.qty - inCart;

  const url = `${location.origin}${location.pathname}#/product/${p.id}`;
  const text = `${p.name} – ₹${Store.price(p)} · ${Store.data.settings.shopName}`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); } };
  const share = () => (navigator.share ? navigator.share({ title: p.name, text, url }).catch(() => {}) : copy());

  const add = go => {
    if (!Store.addToCart(p.id, qty)) return toast('Not enough stock');
    toast('Added to cart 🛍️');
    if (go) nav('/cart');
  };

  return (
    <div className="detail">
      <div className="gallery">
        <img className="main" src={p.images[img]} alt={p.name} />
        {p.images.length > 1 && (
          <div className="thumbs">
            {p.images.map((s, i) => <img key={i} src={s} alt="" className={i === img ? 'on' : ''} onClick={() => setImg(i)} />)}
          </div>
        )}
      </div>
      <div className="meta">
        <Link to={`/?cat=${encodeURIComponent(p.category)}`} className="muted">{p.category}</Link>
        <h1>{p.name}</h1>
        <RatingSummary productId={p.id} />
        <Price p={p} />
        <p className={`stock ${st.cls}`}>{st.text}</p>
        <p className="desc">{p.description}</p>
        {p.qty > 0 && room > 0 && (
          <div className="row">
            <div className="qty">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(q => Math.min(room, q + 1))} aria-label="More">+</button>
            </div>
            <button className="btn" onClick={() => add(false)}>Add to cart</button>
            <button className="btn ghost" onClick={() => add(true)}>Buy now</button>
          </div>
        )}
        {p.qty > 0 && room <= 0 && <p className="muted">You already have all available stock in your cart. <Link to="/cart">View cart</Link></p>}
        {p.qty <= 0 && <button className="btn" disabled>Sold out</button>}
        <div className="row share">
          <button className="btn ghost small" onClick={share}><Icon name="share" size={16} /> Share</button>
          <a className="btn small wa" href={waLink('', `${text}\n${url}`)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> WhatsApp</a>
          <button className="btn ghost small" onClick={copy}><Icon name="copy" size={16} /> Copy link</button>
        </div>
        <p className="muted small">Sharing to Instagram? Tap Share and choose Instagram, or copy the link for your story or bio.</p>
        <p className="muted small">Handmade with love · Delivery charges are added at checkout.</p>
      </div>
      <div className="wide"><Reviews productId={p.id} productName={p.name} /></div>
    </div>
  );
}
