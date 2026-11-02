import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Store, useStore } from './store';
import { Icon, MapBlock, Toast, Loader, Img } from './ui';
import { Avatar, useAuth } from './auth';
import { REMOTE } from './api';
import { useOrderSync } from './sync';
import { InstallBanner } from './pwa';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Pay from './pages/Pay';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Invoice from './pages/Invoice';
import ReviewsPage from './pages/ReviewsPage';

function useTheme() {
  const theme = Store.prefs().theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name=theme-color]')
        ?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useStore();
  useTheme();
  const { enabled, user } = useAuth();
  const [q, setQ] = useState('');
  const [sugOpen, setSugOpen] = useState(false);
  useOrderSync({ poll: true });
  const nav = useNavigate();
  const loc = useLocation();
  const s = Store.data.settings;
  const inAdmin = loc.pathname.startsWith('/admin');
  const count = Store.cart().reduce((a, l) => a + l.qty, 0);

  useEffect(() => { window.scrollTo(0, 0); setSugOpen(false); }, [loc.pathname]);

  // Keep the shared catalog fresh (not while the admin is editing it).
  useEffect(() => {
    if (!REMOTE) return;
    Store.refresh();
    const run = () => { if (!document.hidden && !window.location.hash.startsWith('#/admin')) Store.refresh(); };
    const t = setInterval(run, 300000);
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run); };
  }, []);

  const term = q.trim().toLowerCase();
  const suggestions = term
    ? Store.data.products
        .filter(p => `${p.name} ${p.category}`.toLowerCase().includes(term))
        .sort((a, b) => Number(a.name.toLowerCase().startsWith(term) ? 0 : 1) - Number(b.name.toLowerCase().startsWith(term) ? 0 : 1))
        .slice(0, 6)
    : [];
  const cats = term ? Store.data.categories.filter(c => c.toLowerCase().includes(term)).slice(0, 2) : [];

  const search = e => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(q)}`); };
  const accountTo = '/profile';

  const tabs = [
    ['/', 'home', 'Home', true],
    ['/shop', 'grid', 'Shop'],
    ['/cart', 'bag', 'Cart'],
    ['/orders', 'box', 'Orders'],
    [accountTo, 'user', enabled && !user ? 'Sign in' : 'Profile']
  ];

  return (
    <div className={`shell${inAdmin ? ' admin-mode' : ''}`}>
      <header className={`top${inAdmin ? ' admin-top' : ''}`}>
        <Link to="/" className="brand">
          <Img src={s.logo} w={160} alt="" />
          <span><b>{s.shopName}</b><small>{s.tagline}</small></span>
        </Link>
        {inAdmin && <><span className="admin-badge">Admin</span><Link to="/" className="btn small ghost">View shop</Link></>}
        {!inAdmin && <nav className="dnav" aria-label="Main">
          {tabs.map(([to, , label, end]) => <NavLink key={to} to={to} end={end}>{label}{to === '/cart' && count > 0 && <i className="dot inline">{count}</i>}</NavLink>)}
          <NavLink to="/reviews">Reviews</NavLink>
        </nav>}
        {!inAdmin && <form className="search" onSubmit={search} role="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={e => { setQ(e.target.value); setSugOpen(true); }} onFocus={() => setSugOpen(true)}
            onBlur={() => setTimeout(() => setSugOpen(false), 150)} placeholder="Search treasures…" aria-label="Search products" autoComplete="off" />
          {sugOpen && (suggestions.length > 0 || cats.length > 0) && (
            <ul className="sugg" role="listbox">
              {cats.map(c => (
                <li key={c}><button type="button" onMouseDown={() => { setSugOpen(false); nav(`/shop?cat=${encodeURIComponent(c)}`); }}>
                  <span className="sg-ico">🗂️</span><span>{c}</span><small className="muted">Category</small></button></li>
              ))}
              {suggestions.map(p => (
                <li key={p.id}><button type="button" onMouseDown={() => { setSugOpen(false); setQ(''); nav(`/product/${p.id}`); }}>
                  <Img src={p.images[0]} w={96} alt="" /><span>{p.name}</span><small>₹{Store.price(p)}</small></button></li>
              ))}
            </ul>
          )}
        </form>}
        {!inAdmin && <div className="actions">
          {enabled && !user && <Link to="/login" className="btn small signin">Sign in</Link>}
          {user && <Link to="/profile" className="icon" title={user.name}><Avatar user={user} size={30} /></Link>}
          <Link to="/profile" className="icon only-d" title="Settings"><Icon name="sliders" /></Link>
        </div>}
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/pay/:id" element={<Pay />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/invoice/:id" element={<Invoice />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<div className="empty">Page not found. <Link to="/">Go home</Link></div>} />
        </Routes>
      </main>

      {!inAdmin && <footer className="foot">
        <div className="foot-cols">
          <section className="foot-about">
            <Img src={s.logo} w={160} alt="" />
            <h3>About us</h3>
            <p>{s.about}</p>
          </section>
          <section className="foot-loc">
            <h3>Find us</h3>
            <p>📍 {s.address}<br />📞 {s.phone}{s.email && <><br />✉️ {s.email}</>}</p>
            <MapBlock />
          </section>
        </div>
        <p className="links">
          {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>}
          <Link to="/reviews">Reviews</Link>
          <a href="privacy.html">Privacy policy</a>
          <Link to="/admin">Admin</Link>
        </p>
        <small className="muted">© {new Date().getFullYear()} {s.shopName} · {s.tagline}</small>
      </footer>}

      {!inAdmin && <nav className="tabbar" aria-label="Main">
        {tabs.map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={end}>
            <span className="ti"><Icon name={icon} />{to === '/cart' && count > 0 && <i className="dot">{count}</i>}</span>
            <small>{label}</small>
          </NavLink>
        ))}
      </nav>}

      <InstallBanner show={!/^\/(cart|pay|order|invoice|product|admin)/.test(loc.pathname) && (Boolean(user) || loc.pathname === '/login')} />
      <Toast />
      <Loader />
    </div>
  );
}
