import { Link } from 'react-router-dom';
import { Store, money } from '../store';
import { useAuth } from '../auth';

export default function Orders() {
  const { enabled, user } = useAuth();
  if (enabled && !user) return <div className="empty"><p>Sign in to see your orders.</p><Link className="btn" to="/login?next=/orders">Sign in</Link></div>;
  const orders = Store.orders().filter(o => (o.userEmail || '') === (user?.email || ''));
  if (!orders.length) return <div className="empty"><p>No orders yet.</p><Link className="btn" to="/">Shop now</Link></div>;
  return (
    <div className="orders">
      <h1>My orders</h1>
      <p className="muted small">Saved on this device for now; they will follow your Google account once cloud sync is on.</p>
      {orders.map(o => (
        <div className="card order" key={o.id}>
          <div className="row between">
            <b>{o.id}</b>
            <span className={`pill ${o.status.replace(/\s/g, '').toLowerCase()}`}>{o.status}</span>
          </div>
          <small className="muted">{new Date(o.date).toLocaleString()}</small>
          <ul>{o.items.map((i, k) => <li key={k}>{i.name} × {i.qty}</li>)}</ul>
          <div className="row between">
            <b>{money(o.total)}</b>
            {o.status === 'Awaiting payment' && <Link className="btn small" to={`/pay/${o.id}`}>Pay now</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}
