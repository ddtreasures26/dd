import { Link } from 'react-router-dom';
import { Store, money } from '../store';

export default function Orders() {
  const orders = Store.orders();
  if (!orders.length) return <div className="empty"><p>No orders yet.</p><Link className="btn" to="/">Shop now</Link></div>;
  return (
    <div className="orders">
      <h1>My orders</h1>
      <p className="muted small">Saved on this device. (Sign-in will sync them across devices later.)</p>
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
