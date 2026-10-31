import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Store, useStore } from './store';
import { Icon, MapBlock, Toast } from './ui';
import { Avatar, useAuth } from './auth';
import { InstallBanner } from './pwa';
import Home from './pages/Home';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Pay from './pages/Pay';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Login from './pages/Login';
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
  const nav = useNavigate();
  const loc = useLocation();
  const s = Store.data.settings;
  const count = Store.cart().reduce((a, l) => a + l.qty, 0);

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  const search = e => { e.preventDefault(); nav(`/?q=${encodeURIComponent(q)}`); };
  const accountTo = '/profile';

  const tabs = [
    ['/', 'home', 'Home', true],
    ['/reviews', 'star', 'Reviews'],
    ['/cart', 'bag', 'Cart'],
    ['/orders', 'box', 'Orders'],
    [accountTo, 'user', enabled && !user ? 'Sign in' : 'Profile']
  ];

  return (
    <div className="shell">
      <header className="top">
        <Link to="/" className="brand">
          <img src={s.logo} alt="" />
          <span><b>{s.shopName}</b><small>{s.tagline}</small></span>
        </Link>
        <nav className="dnav" aria-label="Main">
          {tabs.map(([to, , label, end]) => <NavLink key={to} to={to} end={end}>{label}{to === '/cart' && count > 0 && <i className="dot inline">{count}</i>}</NavLink>)}
        </nav>
        <form className="search" onSubmit={search} role="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search treasures…" aria-label="Search products" />
        </form>
        <div className="actions">
          {enabled && !user && <Link to="/login" className="btn small signin">Sign in</Link>}
          {user && <Link to="/profile" className="icon" title={user.name}><Avatar user={user} size={30} /></Link>}
          <Link to="/profile" className="icon only-d" title="Settings"><Icon name="sliders" /></Link>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/pay/:id" element={<Pay />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="*" element={<div className="empty">Page not found. <Link to="/">Go home</Link></div>} />
        </Routes>
      </main>

      <footer className="foot">
        <img src={s.logo} alt="" />
        <p>{s.about}</p>
        <p>📍 {s.address}<br />📞 {s.phone}{s.email && <><br />✉️ {s.email}</>}</p>
        <MapBlock />
        <p className="links">
          {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>}
          <Link to="/reviews">Reviews</Link>
          <a href="privacy.html">Privacy policy</a>
          <Link to="/admin">Admin</Link>
        </p>
        <small className="muted">© {new Date().getFullYear()} {s.shopName} · {s.tagline}</small>
      </footer>

      <nav className="tabbar" aria-label="Main">
        {tabs.map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={end}>
            <span className="ti"><Icon name={icon} />{to === '/cart' && count > 0 && <i className="dot">{count}</i>}</span>
            <small>{label}</small>
          </NavLink>
        ))}
      </nav>

      <InstallBanner show={Boolean(user) || loc.pathname === '/login'} />
      <Toast />
    </div>
  );
}
