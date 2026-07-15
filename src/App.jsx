import React, { Suspense, lazy, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

// Le poste de pilotage est charge a la demande, dans un chunk separe (panel-*)
// que le serveur public ne sert pas. Il ne fait donc pas partie du bundle que
// l'agent recupere sur la cible.
const Lab = lazy(() => import('./Lab.jsx'));

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
const go = (h) => { window.location.hash = h; };

export default function App() {
  const hash = useHash();
  if (hash.startsWith('#lab')) return (
    <div className="app">
      <Suspense fallback={<p style={{ padding: 20 }}>Chargement…</p>}><Lab /></Suspense>
    </div>
  );
  return <Shop hash={hash} />;
}

// =============================================================================
//  Boutique CartaVault
// =============================================================================
function Shop({ hash }) {
  const [me, setMe] = useState(null);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (getToken()) api.me().then((r) => setMe(r.user)).catch(() => { setToken(null); setMe(null); });
  }, []);

  const route = parseRoute(hash);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(item) {
    setCart((c) => [...c, item]);
    go('#/panier');
  }
  function logout() { setToken(null); setMe(null); go('#/'); }

  return (
    <div className="app shop">
      <header className="topbar">
        <div className="brand" onClick={() => go('#/')} role="button">
          <span className="logo">◆</span> CartaVault
        </div>
        <nav>
          <button onClick={() => go('#/')}>Boutique</button>
          <button onClick={() => go('#/panier')}>Panier{cartCount ? ` (${cartCount})` : ''}</button>
          {me
            ? <button onClick={() => go('#/compte')}>Mon compte</button>
            : <button onClick={() => go('#/connexion')}>Connexion</button>}
          {me && <button className="ghost" onClick={logout}>Deconnexion</button>}
        </nav>
      </header>

      <main>
        {route.name === 'home' && <Catalog onOpen={(id) => go(`#/carte/${id}`)} />}
        {route.name === 'product' && <Product id={route.id} onAdd={addToCart} />}
        {route.name === 'cart' && <Cart cart={cart} setCart={setCart} me={me} />}
        {route.name === 'login' && <Login onLogin={(u) => { setMe(u); go('#/compte'); }} />}
        {route.name === 'account' && <Account me={me} />}
        {route.name === 'order' && <OrderDetail id={route.id} />}
      </main>

      <footer className="foot">
        <span>CartaVault — cartes cadeaux numeriques</span>
        <span className="muted small">Livraison instantanee par e-mail · Support 7j/7 · CGV · Mentions legales</span>
      </footer>
    </div>
  );
}

function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (h.startsWith('/carte/')) return { name: 'product', id: h.split('/')[2] };
  if (h.startsWith('/commande/')) return { name: 'order', id: h.split('/')[2] };
  if (h === '/panier') return { name: 'cart' };
  if (h === '/connexion') return { name: 'login' };
  if (h === '/compte') return { name: 'account' };
  return { name: 'home' };
}

// ---- Catalogue --------------------------------------------------------------
function Catalog({ onOpen }) {
  const [products, setProducts] = useState([]);
  useEffect(() => { api.products().then((r) => setProducts(r.products)); }, []);
  return (
    <>
      <section className="hero">
        <h1>Des cartes cadeaux, livrees en un instant</h1>
        <p>Gaming, streaming, musique, shopping. Code envoye par e-mail, valable partout.</p>
      </section>
      <section className="cat-grid">
        {products.map((p) => (
          <article key={p.id} className="prod" onClick={() => onOpen(p.id)}>
            <div className="prod-art" style={{ background: `linear-gradient(135deg, ${p.color}, #0d1117)` }}>
              <span className="prod-brand">{p.brand}</span>
            </div>
            <div className="prod-body">
              <div className="prod-cat">{p.category}</div>
              <h3>{p.brand}</h3>
              <p className="muted small">{p.blurb}</p>
              <div className="prod-from">des {Math.min(...p.denominations)} €</div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

// ---- Fiche produit ----------------------------------------------------------
function Product({ id, onAdd }) {
  const [p, setP] = useState(null);
  const [amount, setAmount] = useState(null);
  const [qty, setQty] = useState(1);
  useEffect(() => { api.product(id).then((r) => { setP(r.product); setAmount(r.product.denominations[0]); }); }, [id]);
  if (!p) return <p className="pad">Chargement…</p>;
  return (
    <div className="product">
      <div className="prod-art big" style={{ background: `linear-gradient(135deg, ${p.color}, #0d1117)` }}>
        <span className="prod-brand">{p.brand}</span>
      </div>
      <div className="product-info">
        <div className="prod-cat">{p.category}</div>
        <h1>Carte cadeau {p.brand}</h1>
        <p className="muted">{p.blurb}</p>
        <label className="fld">Montant
          <div className="denoms">
            {p.denominations.map((d) => (
              <button key={d} className={amount === d ? 'on' : ''} onClick={() => setAmount(d)}>{d} €</button>
            ))}
          </div>
        </label>
        <label className="fld">Quantite
          <input type="number" min="1" max="10" value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
        </label>
        <button className="primary" onClick={() => onAdd({ brand: p.brand, amount, qty })}>
          Ajouter au panier — {amount * qty} €
        </button>
      </div>
    </div>
  );
}

// ---- Panier / checkout ------------------------------------------------------
function Cart({ cart, setCart, me }) {
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const total = cart.reduce((s, i) => s + i.amount * i.qty, 0);

  async function checkout() {
    setErr('');
    try {
      const r = await api.checkout(cart);
      setDone(r.order);
      setCart([]);
    } catch (e) {
      if (e.status === 401) setErr('Connecte-toi pour finaliser la commande.');
      else setErr('Erreur lors du paiement.');
    }
  }

  if (done) return (
    <div className="pad">
      <h1>Merci !</h1>
      <p>Commande <code>#{done.id}</code> confirmee. Les codes ont ete envoyes a {done.email}.</p>
      <a className="link" href={`#/commande/${done.id}`}>Voir la commande</a>
    </div>
  );

  return (
    <div className="pad">
      <h1>Panier</h1>
      {cart.length === 0 && <p className="muted">Ton panier est vide.</p>}
      {cart.map((i, k) => (
        <div className="line" key={k}>
          <span>{i.brand} — {i.amount} € × {i.qty}</span>
          <strong>{i.amount * i.qty} €</strong>
        </div>
      ))}
      {cart.length > 0 && (
        <>
          <div className="line total"><span>Total</span><strong>{total} €</strong></div>
          {!me && <p className="muted small">Tu dois etre connecte pour payer.</p>}
          {err && <p className="err">{err}</p>}
          <button className="primary" onClick={checkout}>Payer {total} €</button>
        </>
      )}
    </div>
  );
}

// ---- Connexion --------------------------------------------------------------
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const r = await api.login(email, password);
      setToken(r.token);
      onLogin(r.user);
    } catch { setErr('Identifiants invalides.'); }
  }
  return (
    <div className="pad narrow">
      <h1>Connexion</h1>
      <form onSubmit={submit}>
        <label className="fld">E-mail
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="fld">Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="primary" type="submit">Se connecter</button>
      </form>
      <p className="muted small">Pas encore de compte ? La creation de compte est momentanement desactivee.</p>
    </div>
  );
}

// ---- Compte : historique de commandes (les tiennes uniquement) --------------
function Account({ me }) {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.orders().then((r) => setOrders(r.orders)).catch(() => setOrders([])); }, []);
  if (!me) return <div className="pad"><p>Connecte-toi pour voir ton compte. <a className="link" href="#/connexion">Connexion</a></p></div>;
  return (
    <div className="pad">
      <h1>Bonjour, {me.name}</h1>
      <p className="muted">{me.email}</p>
      <h2>Mes commandes</h2>
      {orders === null && <p>Chargement…</p>}
      {orders && orders.length === 0 && <p className="muted">Aucune commande.</p>}
      <div className="orders">
        {orders && orders.map((o) => (
          <a key={o.id} className="ordercard" href={`#/commande/${o.id}`}>
            <div><strong>Commande #{o.id}</strong><span className={`st st-${o.status}`}>{o.status}</span></div>
            <div className="muted small">{o.date} · {o.items.map((i) => i.brand).join(', ')}</div>
            <div className="total">{o.total} €</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ---- Detail commande (affiche les codes) ------------------------------------
function OrderDetail({ id }) {
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.order(id).then((r) => setOrder(r.order)).catch((e) => {
      setErr(e.status === 401 ? 'Connecte-toi pour voir cette commande.' : 'Commande introuvable.');
    });
  }, [id]);
  if (err) return <div className="pad"><p className="err">{err}</p><a className="link" href="#/compte">Retour</a></div>;
  if (!order) return <p className="pad">Chargement…</p>;
  return (
    <div className="pad">
      <a className="link" href="#/compte">← Mes commandes</a>
      <h1>Commande #{order.id}</h1>
      <p className="muted">{order.date} · {order.status} · envoyee a {order.email}</p>
      <div className="orderitems">
        {order.items.map((it, k) => (
          <div className="orderitem" key={k}>
            <div><strong>{it.brand}</strong> — {it.amount} € × {it.qty}</div>
            <div className="codebox">
              <span className="muted small">Code cadeau</span>
              <code>{it.code}</code>
            </div>
          </div>
        ))}
      </div>
      <div className="line total"><span>Total</span><strong>{order.total} €</strong></div>
    </div>
  );
}
