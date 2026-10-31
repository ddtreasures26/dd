import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Store } from '../store';
import { Price, RatingSummary, Reviews, stockLabel, toast } from '../ui';

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
        <p className="muted small">Handmade with love · Delivery charges are added at checkout.</p>
      </div>
      <div className="wide"><Reviews productId={p.id} productName={p.name} /></div>
    </div>
  );
}
