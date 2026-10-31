import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, useAuth } from '../auth';
import { isStandalone, useInstall } from '../pwa';
import { Store, money } from '../store';
import { useOrderSync } from '../sync';
import { toast } from '../ui';

const THEMES = [['auto', '🌓 Auto'], ['light', '☀️ Light'], ['dark', '🌙 Dark'], ['rose', '🌸 Rose']];

export default function Profile() {
  const { enabled, user, isAdmin, signOut } = useAuth();
  const inst = useInstall();
  useOrderSync();
  const key = user?.email || 'guest';
  const [p, setP] = useState(() => Store.profile(key));
  const prefs = Store.prefs();
  const mine = Store.orders().filter(o => (o.userEmail || '') === (user?.email || ''));
  const spent = mine.filter(o => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  const set = k => e => setP({ ...p, [k]: e.target.value });

  if (enabled && !user) {
    return (
      <div className="card login">
        <h1>Your profile</h1>
        <p className="muted">Sign in to see your orders, save delivery details and leave reviews.</p>
        <Link className="btn" to="/login?next=/profile">Sign in with Google</Link>
        <Prefs prefs={prefs} inst={inst} />
      </div>
    );
  }

  const toggleNotify = async () => {
    if (!('Notification' in window)) return toast('Notifications are not supported here');
    if (!prefs.notify) {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') return toast('Notification permission denied');
      Store.setPrefs({ notify: true }); toast('Order notifications on');
    } else { Store.setPrefs({ notify: false }); toast('Order notifications off'); }
  };

  return (
    <div className="profile">
      <section className="card hero-card">
        {user ? <Avatar user={user} size={72} /> : <span className="avatar ph" style={{ width: 72, height: 72 }}>G</span>}
        <div className="grow">
          <h1>{user ? user.name : 'Guest'}</h1>
          <p className="muted">{user ? user.email : 'Browsing as a guest'}</p>
          {isAdmin && <Link className="btn small" to="/admin">Open admin</Link>}
        </div>
      </section>

      <section className="stats">
        <div className="card stat"><b>{mine.length}</b><small>Orders</small></div>
        <div className="card stat"><b>{money(spent)}</b><small>Total spent</small></div>
        <Link to="/orders" className="card stat link-card"><b>→</b><small>View orders</small></Link>
      </section>

      {mine.length > 0 && (
        <section className="card">
          <div className="row between"><h2>Recent orders</h2><Link to="/orders" className="small">See all</Link></div>
          {mine.slice(0, 3).map(o => (
            <Link key={o.id} to={`/order/${o.id}`} className="rowlink">
              <span><b>{o.id}</b><br /><small className="muted">{money(o.total)} · {new Date(o.date).toLocaleDateString()}</small></span>
              <span className={`pill ${o.status.replace(/\s/g, '').toLowerCase()}`}>{o.status}</span>
            </Link>
          ))}
        </section>
      )}

      <form className="card form" onSubmit={e => { e.preventDefault(); Store.setProfile(key, p); toast('Delivery details saved ✓'); }}>
        <h2>Delivery details</h2>
        <p className="muted small">Saved on this device and used to fill in checkout.</p>
        <label>Phone / WhatsApp<input value={p.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></label>
        <label>Address<textarea rows={3} value={p.address} onChange={set('address')} autoComplete="street-address" /></label>
        <div className="two">
          <label>City<input value={p.city} onChange={set('city')} /></label>
          <label>PIN code<input value={p.pin} onChange={set('pin')} inputMode="numeric" /></label>
        </div>
        <button className="btn">Save details</button>
      </form>

      <Prefs prefs={prefs} inst={inst} onNotify={toggleNotify} />

      <section className="card form">
        <h2>More</h2>
        <a className="rowlink" href="privacy.html">Privacy policy <span>›</span></a>
        {Store.data.settings.instagram && <a className="rowlink" href={Store.data.settings.instagram} target="_blank" rel="noreferrer">Instagram <span>›</span></a>}
        {user && <button className="btn ghost danger" onClick={signOut}>Log out</button>}
      </section>
    </div>
  );
}

function Prefs({ prefs, inst, onNotify }) {
  return (
    <section className="card form">
      <h2>Preferences</h2>
      <span className="lbl">Theme</span>
      <div className="seg">
        {THEMES.map(([k, l]) => <button key={k} type="button" className={prefs.theme === k ? 'on' : ''} onClick={() => Store.setPrefs({ theme: k })}>{l}</button>)}
      </div>
      {onNotify && (
        <label className="switch">
          <input type="checkbox" checked={prefs.notify} onChange={onNotify} />
          <span>Order notifications</span>
        </label>
      )}
      {!isStandalone() && !inst.installed && (
        inst.canPrompt
          ? <button type="button" className="btn ghost" onClick={inst.promptInstall}>📲 Install app</button>
          : <p className="muted small">To install: {inst.ios ? 'tap Share → Add to Home Screen.' : 'browser menu ⋮ → Install app / Add to Home screen.'}</p>
      )}
    </section>
  );
}
