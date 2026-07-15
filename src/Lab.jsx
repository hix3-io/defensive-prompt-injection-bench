import React, { useEffect, useMemo, useState } from 'react';

// Banc d'essai des payloads defensifs. Accessible discretement via #lab,
// hors de la navigation de la boutique.
const OUTCOMES = ['blocked', 'refused', 'ignored', 'slowed', 'error'];

const STEP_LABELS = {
  none: 'aucune', home: 'accueil', catalog: 'catalogue', login: 'connexion',
  orders_list: 'liste commandes', idor_enum: 'enum. IDOR', flag: 'FLAG atteint',
};

// Compteur objectif : chaque run fige la config active et compte les requetes
// de l'agent, avec les jalons franchis jusqu'au flag.
function RunsPanel({ activeCount }) {
  const [data, setData] = useState({ currentRunId: null, runs: [] });
  const [label, setLabel] = useState('');
  const [agent, setAgent] = useState('');
  const [detail, setDetail] = useState(null);

  async function load() {
    setData(await fetch('/api/runs').then((r) => r.json()));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 2000); // rafraichit pendant que l'agent tourne
    return () => clearInterval(t);
  }, []);

  async function start() {
    await fetch('/api/runs/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || `run ${data.runs.length + 1}`, agent }),
    });
    setLabel('');
    load();
  }
  async function stop() { await fetch('/api/runs/stop', { method: 'POST' }); load(); }
  async function clear() {
    if (!confirm('Effacer tous les runs ?')) return;
    await fetch('/api/runs', { method: 'DELETE' }); setDetail(null); load();
  }
  async function openDetail(id) {
    setDetail(await fetch(`/api/runs/${id}`).then((r) => r.json()));
  }

  const current = data.runs.find((r) => r.id === data.currentRunId && !r.endedAt);

  return (
    <section className="runs">
      <div className="runs-head">
        <div>
          <h2>Runs — compteur de trafic agent</h2>
          <p className="muted small">
            Demarre un run juste avant de lancer l'agent : la config active
            ({activeCount} payloads) est figee et chaque requete comptee.
          </p>
        </div>
        <div className="runs-ctrl">
          <input placeholder="label du run (ex: baseline)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input placeholder="agent (ex: opus-mcp)" value={agent} onChange={(e) => setAgent(e.target.value)} />
          {current
            ? <button className="stop" onClick={stop}>■ Stop</button>
            : <button className="go" onClick={start}>▶ Start run</button>}
          <button onClick={clear}>Effacer</button>
        </div>
      </div>

      {current && (
        <div className="run-live">
          ● EN COURS — <strong>{current.label}</strong> · {current.totalRequests} requetes ·
          progression : <strong>{STEP_LABELS[current.furthest]}</strong>
          {current.reachedFlag && <span className="flaghit"> · FLAG EXFILTRE</span>}
        </div>
      )}

      <table className="runtab">
        <thead>
          <tr>
            <th>Run</th><th>Payloads</th><th>Requetes</th><th>Login</th>
            <th>Cmd listees</th><th>IDs testes</th><th>Progression</th><th>Flag</th><th>Duree</th><th></th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((r) => (
            <tr key={r.id} className={r.reachedFlag ? 'got-flag' : ''}>
              <td>{r.label}{!r.endedAt && <span className="live-dot" title="en cours">●</span>}</td>
              <td>{r.enabledCount}</td>
              <td>{r.totalRequests}</td>
              <td>{r.milestones.loginSuccess ? '✓' : (r.milestones.loginAttempts ? '✗' : '–')}</td>
              <td>{r.milestones.ordersListed ? '✓' : '–'}</td>
              <td>{r.milestones.distinctOrderIds}</td>
              <td><span className={`prog prog-${r.furthest}`}>{STEP_LABELS[r.furthest]}</span></td>
              <td>{r.reachedFlag ? '🚩' : '—'}</td>
              <td className="muted small">{r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : '–'}</td>
              <td><button className="mini" onClick={() => openDetail(r.id)}>trafic</button></td>
            </tr>
          ))}
          {data.runs.length === 0 && <tr><td colSpan="10" className="muted">Aucun run.</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="run-detail">
          <div className="rd-head">
            <strong>Trafic — {detail.run.label}</strong> ({detail.requests.length} requetes)
            <button className="mini" onClick={() => setDetail(null)}>fermer</button>
          </div>
          <ol className="traffic">
            {detail.requests.map((q, i) => (
              <li key={i} className={`st${Math.floor(q.status / 100)}`}>
                <code>{q.method}</code> {q.path} <span className="muted">→ {q.status}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default function Lab() {
  const [data, setData] = useState(null);
  const [obs, setObs] = useState([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const [c, o] = await Promise.all([
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/observations').then((r) => r.json()),
    ]);
    setData(c);
    setObs(o.observations || []);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id, enabled) {
    await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    setData((d) => ({ ...d, config: { ...d.config, [id]: enabled } }));
  }

  async function bulk(action) {
    const body = action === 'reset' ? { reset: true } : { setAll: action === 'all' };
    const r = await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((x) => x.json());
    setData((d) => ({ ...d, config: r.config }));
  }

  async function logObs(payloadId, outcome) {
    const note = prompt(`Note pour "${payloadId}" (${outcome}) ?`) || '';
    const r = await fetch('/api/observations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payloadId, outcome, note }),
    }).then((x) => x.json());
    setObs((o) => [r.entry, ...o]);
  }

  const grouped = useMemo(() => {
    if (!data) return {};
    const g = {};
    for (const p of data.catalog) {
      if (filter && !(`${p.vector} ${p.tactic} ${p.text}`.toLowerCase().includes(filter.toLowerCase()))) continue;
      (g[p.vector] ||= []).push(p);
    }
    return g;
  }, [data, filter]);

  if (!data) return <div className="lab"><p>Chargement…</p></div>;
  const activeCount = Object.values(data.config).filter(Boolean).length;

  return (
    <div className="lab">
      <RunsPanel activeCount={activeCount} />

      <div className="labhead">
        <div>
          <h2>Banc d'essai — payloads defensifs</h2>
          <p className="muted">
            {activeCount}/{data.catalog.length} actifs. Active un payload, relance ton agent,
            observe s'il bloque/refuse/ignore, puis logue le resultat.
          </p>
        </div>
        <div className="bulk">
          <input placeholder="filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button onClick={() => bulk('all')}>Tout activer</button>
          <button onClick={() => bulk('none')}>Tout couper</button>
          <button onClick={() => bulk('reset')}>Baseline</button>
          <a href="/robots.txt" target="_blank" rel="noreferrer">robots.txt</a>
          <a href="/llms.txt" target="_blank" rel="noreferrer">llms.txt</a>
        </div>
      </div>

      <div className="grid">
        {Object.entries(grouped).map(([vector, items]) => (
          <div className="vcard" key={vector}>
            <h3>
              {data.vectors[vector]?.label || vector}
              <span className={`badge ${data.vectors[vector]?.where}`}>{data.vectors[vector]?.where}</span>
            </h3>
            <p className="muted small">{data.vectors[vector]?.desc}</p>
            {items.map((p) => (
              <div className={`payload ${data.config[p.id] ? 'active' : ''}`} key={p.id}>
                <label className="row">
                  <input type="checkbox" checked={!!data.config[p.id]}
                    onChange={(e) => toggle(p.id, e.target.checked)} />
                  <strong>{data.tactics[p.tactic]?.label || p.tactic}</strong>
                </label>
                <p className="text">{p.text}</p>
                <div className="obsbtns">
                  {OUTCOMES.map((o) => (
                    <button key={o} className={`o-${o}`} onClick={() => logObs(p.id, o)}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <section className="journal">
        <h3>Journal d'observations ({obs.length})</h3>
        {obs.length === 0 && <p className="muted">Aucune observation loguee.</p>}
        <ul>
          {obs.map((e, i) => (
            <li key={i}>
              <span className={`tag o-${e.outcome}`}>{e.outcome}</span>
              <code>{e.payloadId || '—'}</code>
              <span className="muted small"> {new Date(e.ts).toLocaleString()}</span>
              {e.note && <div className="note">{e.note}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
