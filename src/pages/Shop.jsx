import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, money } from '../store';
import { Icon, ProductCard } from '../ui';

const PAGE = 24;
const SORTS = [
  ['newest', 'Newest first'],
  ['low', 'Price: low to high'],
  ['high', 'Price: high to low'],
  ['rating', 'Top rated'],
  ['name', 'Name: A to Z']
];
const listOf = (sp, k) => (sp.get(k) || '').split(',').filter(Boolean);
const natural = ([a], [b]) => (isNaN(a) || isNaN(b) ? 0 : Number(a) - Number(b));

/** Everything the shopper picked, read from (and written to) the URL so a filtered view can be shared. */
function useFilters() {
  const [sp, setSp] = useSearchParams();
  const f = {
    q: (sp.get('q') || '').trim(),
    cats: listOf(sp, 'cat'),
    sort: SORTS.some(s => s[0] === sp.get('sort')) ? sp.get('sort') : 'newest',
    stock: sp.get('stock') === '1',
    offer: sp.get('offer') === '1',
    min: sp.get('min') || '',
    max: sp.get('max') || '',
    opts: Object.fromEntries([...new Set([...sp.keys()].filter(k => k.startsWith('o.')))].map(k => [k.slice(2), listOf(sp, k)]))
  };
  const set = patch => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSp(next, { replace: true });
  };
  const toggle = (key, value) => {
    const cur = listOf(sp, key);
    set({ [key]: (cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]).join(',') });
  };
  const clear = () => setSp(f.q ? new URLSearchParams({ q: f.q }) : new URLSearchParams(), { replace: true });
  return { f, set, toggle, clear };
}

function PriceRange({ f, set }) {
  const [lo, setLo] = useState(f.min);
  const [hi, setHi] = useState(f.max);
  const commit = () => set({ min: lo && Number(lo) > 0 ? String(Number(lo)) : '', max: hi && Number(hi) > 0 ? String(Number(hi)) : '' });
  const key = e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
  return (
    <div className="frange">
      <input inputMode="numeric" placeholder="Min ₹" aria-label="Minimum price" value={lo} onChange={e => setLo(e.target.value.replace(/\D/g, ''))} onBlur={commit} onKeyDown={key} />
      <span className="muted">to</span>
      <input inputMode="numeric" placeholder="Max ₹" aria-label="Maximum price" value={hi} onChange={e => setHi(e.target.value.replace(/\D/g, ''))} onBlur={commit} onKeyDown={key} />
    </div>
  );
}

function FilterPanel({ f, set, toggle, clear, facets, showSort, active }) {
  return (
    <div className="fpanel">
      <div className="row between">
        <h2>Filters</h2>
        {active > 0 && <button className="link" onClick={clear}>Clear all ({active})</button>}
      </div>

      {showSort && (
        <fieldset className="fgroup">
          <legend>Sort by</legend>
          {SORTS.map(([k, label]) => (
            <label className="fcheck" key={k}>
              <input type="radio" name="sort" checked={f.sort === k} onChange={() => set({ sort: k === 'newest' ? '' : k })} />{label}
            </label>
          ))}
        </fieldset>
      )}

      {facets.cats.length > 0 && (
        <fieldset className="fgroup">
          <legend>Category</legend>
          {facets.cats.map(([c, n]) => (
            <label className="fcheck" key={c}>
              <input type="checkbox" checked={f.cats.includes(c)} onChange={() => toggle('cat', c)} />{c}<small>{n}</small>
            </label>
          ))}
        </fieldset>
      )}

      {facets.groups.map(([name, values]) => (
        <fieldset className="fgroup" key={name}>
          <legend>{name}</legend>
          <div className="fpills">
            {values.map(([v, n]) => {
              const on = (f.opts[name] || []).includes(v);
              return <button type="button" key={v} className={`fpill${on ? ' on' : ''}`} aria-pressed={on} title={`${n} product(s)`} onClick={() => toggle(`o.${name}`, v)}>{v}</button>;
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="fgroup">
        <legend>Price {facets.min < facets.max && <small className="muted">({money(facets.min)} – {money(facets.max)})</small>}</legend>
        <PriceRange key={`${f.min}-${f.max}`} f={f} set={set} />
      </fieldset>

      <fieldset className="fgroup">
        <legend>Availability</legend>
        <label className="fcheck"><input type="checkbox" checked={f.stock} onChange={() => set({ stock: f.stock ? '' : '1' })} />In stock only</label>
        <label className="fcheck"><input type="checkbox" checked={f.offer} onChange={() => set({ offer: f.offer ? '' : '1' })} />On offer</label>
      </fieldset>
    </div>
  );
}

export default function Shop() {
  const nav = useNavigate();
  const { f, set, toggle, clear } = useFilters();
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const { products, categories } = Store.data;

  // what is available to filter by, taken from the whole catalogue
  const names = [...categories, ...products.map(p => p.category).filter(c => !categories.includes(c))];
  const groups = {};
  products.forEach(p => (p.options || []).forEach(g => {
    const m = (groups[g.name] ||= new Map());
    g.values.forEach(v => m.set(v, (m.get(v) || 0) + 1));
  }));
  const prices = products.map(p => Store.price(p));
  const facets = {
    cats: [...new Set(names)].map(c => [c, products.filter(p => p.category === c).length]).filter(([, n]) => n > 0),
    groups: Object.entries(groups).map(([name, m]) => [name, [...m.entries()].sort(natural)]),
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0
  };

  const q = f.q.toLowerCase();
  const lo = Number(f.min) || 0;
  const hi = Number(f.max) || Infinity;
  const matches = p => {
    if (f.cats.length && !f.cats.includes(p.category)) return false;
    if (f.stock && p.qty <= 0) return false;
    if (f.offer && !(p.offer && p.offerPrice > 0)) return false;
    const price = Store.price(p);
    if (price < lo || price > hi) return false;
    for (const [name, vals] of Object.entries(f.opts)) {
      if (!vals.length) continue;
      const g = (p.options || []).find(x => x.name === name);
      if (!g || !g.values.some(v => vals.includes(v))) return false;
    }
    return !q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q);
  };
  const cmp = {
    newest: (a, b) => (b.p.createdAt || 0) - (a.p.createdAt || 0) || a.i - b.i,
    low: (a, b) => Store.price(a.p) - Store.price(b.p),
    high: (a, b) => Store.price(b.p) - Store.price(a.p),
    rating: (a, b) => Store.rating(b.p.id).avg - Store.rating(a.p.id).avg || a.i - b.i,
    name: (a, b) => a.p.name.localeCompare(b.p.name)
  }[f.sort];
  const results = products.map((p, i) => ({ p, i })).filter(x => matches(x.p)).sort(cmp).map(x => x.p);

  const chips = [
    ...f.cats.map(c => [c, () => toggle('cat', c)]),
    ...Object.entries(f.opts).flatMap(([name, vals]) => vals.map(v => [`${name}: ${v}`, () => toggle(`o.${name}`, v)])),
    ...(f.min || f.max ? [[`${f.min ? money(f.min) : '₹0'} – ${f.max ? money(f.max) : 'any'}`, () => set({ min: '', max: '' })]] : []),
    ...(f.stock ? [['In stock', () => set({ stock: '' })]] : []),
    ...(f.offer ? [['On offer', () => set({ offer: '' })]] : [])
  ];
  const active = chips.length;
  const title = f.q ? `Results for “${f.q}”` : f.cats.length === 1 ? f.cats[0] : 'All products';
  const open = id => nav(`/product/${id}`);
  const panel = showSort => <FilterPanel f={f} set={set} toggle={toggle} clear={clear} facets={facets} showSort={showSort} active={active} />;

  return (
    <div className="shop-page">
      <div className="shop-head">
        <h1>{title}</h1>
        <span className="muted">{results.length} product{results.length === 1 ? '' : 's'}</span>
      </div>

      <div className="shop-layout">
        <aside className="filters card" aria-label="Filters">{panel(true)}</aside>

        <div className="shop-main">
          <div className="shop-toolbar">
            <button className="btn ghost small filters-btn" onClick={() => setSheet(true)}>
              <Icon name="filter" size={16} /> Filters{active > 0 && <i className="nb">{active}</i>}
            </button>
            <label className="sortsel sort-mobile">
              <span>Sort</span>
              <select value={f.sort} onChange={e => set({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
                {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map(([label, remove]) => <button key={label} className="achip" onClick={remove} aria-label={`Remove filter ${label}`}>{label} ✕</button>)}
              <button className="link" onClick={clear}>Clear all</button>
            </div>
          )}

          {results.length ? (
            <>
              <div className="grid">{results.slice(0, limit).map(p => <ProductCard key={p.id} p={p} onOpen={open} />)}</div>
              {results.length > limit && (
                <div className="more"><button className="btn ghost" onClick={() => setLimit(l => l + PAGE)}>Show more ({results.length - limit} left)</button></div>
              )}
            </>
          ) : (
            <div className="empty">
              {Store.status === 'loading' && !products.length ? 'Loading treasures…'
                : Store.status === 'error' && !products.length ? 'Could not load the shop. Check your connection and refresh.'
                : <><p>No products match these filters.</p>{active > 0 && <button className="btn ghost" onClick={clear}>Clear filters</button>}</>}
            </div>
          )}
        </div>
      </div>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet filters-sheet" role="dialog" aria-label="Filters" onClick={e => e.stopPropagation()}>
            <div className="sheet-scroll">{panel(false)}</div>
            <button className="btn block-btn" onClick={() => setSheet(false)}>Show {results.length} product{results.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
