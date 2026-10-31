import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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

const FEATURED = 8;

export default function Home() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { settings, categories, products } = Store.data;
  const open = id => nav(`/product/${id}`);

  // old links such as /#/?q=ring or /#/?cat=Rings now live on the Shop page
  if (sp.get('q') || sp.get('cat')) return <Navigate to={`/shop?${sp.toString()}`} replace />;

  const inStock = products.filter(p => p.qty > 0);
  const offers = inStock.filter(p => p.offer);
  const fresh = inStock
    .filter(p => p.createdAt && Date.now() - p.createdAt < 45 * 864e5)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  const recent = Store.recent().map(Store.product).filter(Boolean);
  const featured = (inStock.length ? inStock : products).slice(0, FEATURED);

  return (
    <>
      <Carousel banners={settings.banners} />

      <section className="chips" aria-label="Categories">
        <Link to="/shop" className="on">All</Link>
        {categories.map(c => <Link key={c} to={`/shop?cat=${encodeURIComponent(c)}`}>{c}</Link>)}
      </section>

      {fresh.length > 0 && (
        <section className="block">
          <div className="row between"><h2>✨ New arrivals</h2><Link to="/shop?sort=newest" className="small">See all</Link></div>
          <div className="rail">{fresh.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        </section>
      )}

      {offers.length > 0 && (
        <section className="block offer">
          <div className="row between"><h2>🎁 Offer zone</h2><Link to="/shop?offer=1" className="small">See all</Link></div>
          <div className="rail">{offers.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="block">
          <h2>Recently viewed</h2>
          <div className="rail">{recent.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
        </section>
      )}

      <section className="block">
        <div className="row between"><h2>Our collection</h2><Link to="/shop" className="small">View all</Link></div>
        {featured.length ? (
          <>
            <div className="grid">{featured.map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
            <div className="more"><Link className="btn" to="/shop">View all {products.length} products</Link></div>
          </>
        ) : (
          <div className="empty">{Store.status === 'loading' ? 'Loading treasures…' : Store.status === 'error' ? 'Could not load the shop. Check your connection and refresh.' : 'No products yet.'}</div>
        )}
      </section>

      {settings.promoVideo && (
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
