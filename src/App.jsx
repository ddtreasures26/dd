import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Store, useStore } from './store';
import { Toast, toast } from './ui';
import Home from './pages/Home';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Pay from './pages/Pay';
import Orders from './pages/Orders';
import Admin from './pages/Admin';
import ReviewsPage from './pages/ReviewsPage';

const THEMES = [
  ['auto', '🌓 Auto'],
  ['light', '☀️ Light'],
  ['dark', '🌙 Dark'],
  ['rose', '🌸 Rose']
];

function useTheme() {
  const theme = Store.prefs().theme;
  useEffect(() => {
    const apply = () => {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const t = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name=theme-color]')
        ?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function useInstall() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const h = e => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return evt && (async () => { evt.prompt(); await evt.userChoice; setEvt(null); });
}

function SettingsMenu({ onClose, install }) {
  const prefs = Store.prefs();
  const toggleNotify = async () => {
    if (!('Notification' in window)) return toast('Notifications are not supported here');
    if (!prefs.notify) {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') return toast('Notification permission denied');
      Store.setPrefs({ notify: true });
      toast('Order notifications on');
    } else {
      Store.setPrefs({ notify: false });
      toast('Order notifications off');
    }
  };
  return (
    <div className="menu card" onClick={e => e.stopPropagation()}>
      <h4>Theme</h4>
      <div className="seg">
        {THEMES.map(([k, label]) => (
          <button key={k} className={prefs.theme === k ? 'on' : ''} onClick={() => Store.setPrefs({ theme: k })}>{label}</button>
        ))}
      </div>
      <label className="switch">
        <input type="checkbox" checked={prefs.notify} onChange={toggleNotify} />
        <span>Order notifications</span>
      </label>
      {install && <button className="btn small" onClick={() => { install(); onClose(); }}>📲 Install app</button>}
      <button className="btn ghost small" onClick={onClose}>Close</button>
    </div>
  );
}

export default function App() {
  useStore();
  useTheme();
  const install = useInstall();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const loc = useLocation();
  const s = Store.data.settings;
  const count = Store.cart().reduce((a, l) => a + l.qty, 0);

  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [loc.pathname]);

  const search = e => { e.preventDefault(); nav(`/?q=${encodeURIComponent(q)}`); };

  return (
    <div onClick={() => setMenu(false)}>
      <header className="top">
        <Link to="/" className="brand">
          <img src={s.logo} alt="" />
          <span><b>{s.shopName}</b><small>{s.tagline}</small></span>
        </Link>
        <form className="search" onSubmit={search} role="search">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search treasures…" aria-label="Search products" />
          <button aria-label="Search">🔍</button>
        </form>
        <nav className="actions" onClick={e => e.stopPropagation()}>
          <NavLink to="/reviews" className="icon" title="Reviews">⭐</NavLink>
          <NavLink to="/orders" className="icon" title="My orders">📦</NavLink>
          <NavLink to="/cart" className="icon" title="Cart">🛍️{count > 0 && <i className="dot">{count}</i>}</NavLink>
          <button className="icon" title="Settings" onClick={() => setMenu(m => !m)}>⚙️</button>
          {menu && <SettingsMenu onClose={() => setMenu(false)} install={install} />}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/pay/:id" element={<Pay />} />
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
        <p>
          {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>} ·{' '}
          <Link to="/reviews">Reviews</Link> · <Link to="/admin">Admin</Link>
        </p>
        <small className="muted">© {new Date().getFullYear()} {s.shopName} · {s.tagline}</small>
      </footer>
      <Toast />
    </div>
  );
}
