import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, GoogleButton, useAuth } from '../auth';
import { Store } from '../store';

export default function Login() {
  const { enabled, user, error, signOut } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const next = sp.get('next') || '/';
  const s = Store.data.settings;

  useEffect(() => { if (user && sp.get('next')) nav(next, { replace: true }); }, [user]);

  if (user) {
    return (
      <div className="card login">
        <Avatar user={user} size={64} />
        <h1>Hi, {user.name.split(' ')[0]} 💗</h1>
        <p className="muted">{user.email}</p>
        <Link className="btn" to="/orders">My orders</Link>
        <button className="btn ghost" onClick={signOut}>Log out</button>
      </div>
    );
  }

  return (
    <div className="card login">
      <img className="loginlogo" src={s.logo} alt="" />
      <h1>Welcome</h1>
      <p className="muted">Sign in with Google to place orders, track them and leave reviews.</p>
      {enabled ? <GoogleButton /> : (
        <p className="notice small">Google sign-in isn’t configured yet (test mode) — you can still browse and order as a guest.</p>
      )}
      {error && <p className="notice small">{error}</p>}
      <Link className="btn ghost" to={next}>Continue as guest</Link>
      <small className="muted">We only read your name, email and photo. See our <a href="privacy.html">privacy policy</a>.</small>
    </div>
  );
}
