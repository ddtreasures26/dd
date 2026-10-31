import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, imgUrl } from '../store';
import { ProductCard } from '../ui';

function Carousel({ banners }) {
  const [i, setI] = useState(0);
  const timer = useRef();
  const n = banners.length;
  useEffect(() => {
    if (n < 2) return;
    timer.current = setInterval(() => setI(x => (x + 1) % n), 4500);
    return () => clearInterval(timer.current);
  }, [n]);
  if (!n) return null;
  const go = d => { clearInterval(timer.current); setI(x => (x + d + n) % n); };
  return (
    <section className="carousel" aria-roledescription="carousel">
      <div className="track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, k) => (
          <div className="slide" key={k} style={{ backgroundImage: `url("${imgUrl(b.image, 1400)}")` }}>
            <div className="cap"><h2>{b.title}</h2><p>{b.text}</p></div>
          </div>
        ))}
      </div>
      {n > 1 && <>
        <button className="nav prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
        <button className="nav next" onClick={() => go(1)} aria-label="Next">›</button>
        <div className="dots">
          {banners.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />)}
        </div>
      </>}
    </section>
  );
}

export default function Home() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { settings, categories, products } = Store.data;
  const q = (sp.get('q') || '').trim().toLowerCase();
  const cat = sp.get('cat') || '';
  const open = id => nav(`/product/${id}`);

  const sort = sp.get('sort') || 'newest';
  const stockOnly = sp.get('stock') === '1';
  const cmp = {
    newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.i - b.i,
    low: (a, b) => Store.price(a.p) - Store.price(b.p),
    high: (a, b) => Store.price(b.p) - Store.price(a.p),
    name: (a, b) => a.p.name.localeCompare(b.p.name)
  }[sort] || (() => 0);
  const list = products
    .filter(p =>
      (!cat || p.category === cat) &&
      (!stockOnly || p.qty > 0) &&
      (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)))
    .map((p, i) => ({ p, i, createdAt: p.createdAt }))
    .sort(cmp)
    .map(x => x.p);
  const offers = products.filter(p => p.offer && p.qty > 0);
  const recent = Store.recent().map(Store.product).filter(Boolean);
  const filtering = q || cat || stockOnly;
  const setParam = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n); };
  const setCat = c => { const n = new URLSearchParams(sp); c ? n.set('cat', c) : n.delete('cat'); setSp(n); };

  return (
    <>
      {!filtering && <Carousel banners={settings.banners} />}

      <section className="chips" aria-label="Categories">
        <button className={!cat ? 'on' : ''} onClick={() => setCat('')}>All</button>
        {categories.map(c => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </section>

      {!filtering && offers.length > 0 && (
        <section className="block offer">
          <h2>🎁 Offer zone</h2>
          <div className="rail">{offers.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        </section>
      )}

      {!filtering && recent.length > 0 && (
        <section className="block">
          <h2>Recently viewed</h2>
          <div className="rail">{recent.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        </section>
      )}

      <section className="block">
        <h2>{q ? `Results for “${sp.get('q')}”` : cat || 'All products'} <small className="muted">({list.length})</small></h2>
        <div className="toolbar">
          <label className="sortsel">
            <span>Sort by</span>
            <select value={sort} onChange={e => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </label>
          <button className={`toggle${stockOnly ? ' on' : ''}`} onClick={() => setParam('stock', stockOnly ? '' : '1')} aria-pressed={stockOnly}>In stock only</button>
        </div>
        {list.length ? (
          <div className="grid">{list.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        ) : <div className="empty">{Store.status === 'loading' && !products.length ? 'Loading treasures…' : Store.status === 'error' && !products.length ? 'Could not load the shop. Check your connection and refresh.' : 'No products found.'}</div>}
      </section>

      {!filtering && settings.promoVideo && (
        <section className="block">
          <h2>🎬 Watch our story</h2>
          <Video src={settings.promoVideo} />
        </section>
      )}
    </>
  );
}

export function Video({ src }) {
  const yt = src.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  const drive = src.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (yt) return <iframe className="video" src={`https://www.youtube.com/embed/${yt[1]}`} title="Promo" allowFullScreen />;
  if (drive) return <iframe className="video" src={`https://drive.google.com/file/d/${drive[1]}/preview`} title="Promo" allowFullScreen />;
  return <video className="video" src={src} controls playsInline />;
}
