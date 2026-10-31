import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ADMIN_EMAIL, AUTH_ENABLED, GOOGLE_CLIENT_ID } from './config';
import { Store } from './store';

const KEY = 'ddt.user.v1';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const readUser = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };

function decodeJwt(token) {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(atob(b64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  return JSON.parse(json);
}

let gisPromise;
function loadGIS() {
  gisPromise ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => { gisPromise = null; reject(new Error('Could not load Google sign-in')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [error, setError] = useState('');
  const initialised = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const waiter = useRef(null);

  const handleCredential = useCallback(resp => {
    try {
      const p = decodeJwt(resp.credential);
      if (!p.email_verified) throw new Error('Google email is not verified');
      const u = { email: p.email.toLowerCase(), name: p.name || p.email, picture: p.picture || '', credential: resp.credential, exp: p.exp * 1000 };
      localStorage.setItem(KEY, JSON.stringify(u));
      setUser(u); setError('');
      waiter.current?.(resp.credential); waiter.current = null;
    } catch (e) { setError(e.message); }
  }, []);

  // Initialise Google Identity Services once; later the Drive backend verifies `credential` server-side.
  const init = useCallback(async () => {
    if (!AUTH_ENABLED) return null;
    const g = await loadGIS();
    if (!initialised.current) {
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential, auto_select: true, use_fedcm_for_prompt: true });
      initialised.current = true;
    }
    return g;
  }, [handleCredential]);

  const signOut = useCallback(async () => {
    try { (await init())?.accounts.id.disableAutoSelect(); } catch { /* offline */ }
    localStorage.removeItem(KEY);
    sessionStorage.removeItem('ddt.admin');
    setUser(null);
  }, [init]);

  /** A valid Google ID token for API calls. Google tokens last ~1 hour, so renew quietly when close to expiry. */
  const getToken = useCallback(async () => {
    const u = userRef.current;
    if (!u) throw Object.assign(new Error('Please sign in.'), { code: 'auth' });
    if (u.exp - Date.now() > 90_000) return u.credential;
    const g = await init();
    return new Promise((resolve, reject) => {
      const fail = () => { waiter.current = null; reject(Object.assign(new Error('Your session expired. Please sign in again.'), { code: 'auth' })); };
      const t = setTimeout(fail, 12000);
      waiter.current = c => { clearTimeout(t); resolve(c); };
      g.accounts.id.prompt(n => { if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) { clearTimeout(t); fail(); } });
    });
  }, [init]);
  useEffect(() => { Store.setTokenGetter(getToken); }, [getToken]);

  const value = {
    enabled: AUTH_ENABLED, user, error, init, signOut, getToken,
    isAdmin: Boolean(user && user.email === ADMIN_EMAIL.toLowerCase())
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Renders the official Google button. */
export function GoogleButton() {
  const { init } = useAuth();
  const box = useRef();
  const [failed, setFailed] = useState('');
  useEffect(() => {
    let off = false;
    init().then(g => {
      if (off || !g || !box.current) return;
      const dark = document.documentElement.dataset.theme === 'dark';
      g.accounts.id.renderButton(box.current, {
        theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with',
        width: Math.min(320, box.current.parentElement.clientWidth - 8 || 280)
      });
    }).catch(e => setFailed(e.message));
    return () => { off = true; };
  }, [init]);
  return failed ? <p className="notice small">{failed}. Check your connection and retry.</p> : <div ref={box} className="gbtn" />;
}

export function Avatar({ user, size = 32 }) {
  return user.picture
    ? <img className="avatar" src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" />
    : <span className="avatar ph" style={{ width: size, height: size }}>{user.name[0]?.toUpperCase()}</span>;
}
