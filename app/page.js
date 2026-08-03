'use client';

import { useState, useCallback } from 'react';
import {
  getLeaderboard,
  getPositions,
  isHedger,
  filterPosition,
  getConsensusTrades,
  shortenAddr,
  sleep,
} from './lib/polymarket';

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Geist Mono', 'Fira Code', 'Courier New', monospace",
    fontSize: 13,
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid #27272a',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  title: { fontSize: 15, fontWeight: 700, letterSpacing: 3, color: '#f4f4f5' },
  filterBar: {
    padding: '16px 24px',
    borderBottom: '1px solid #18181b',
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, color: '#52525b', letterSpacing: 1.5 },
  input: {
    background: '#18181b',
    border: '1px solid #27272a',
    color: '#e4e4e7',
    padding: '6px 10px',
    fontFamily: 'inherit',
    fontSize: 12,
    width: 64,
    outline: 'none',
    borderRadius: 2,
  },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  checkLabel: { fontSize: 11, color: '#71717a', cursor: 'pointer' },
  btn: (active) => ({
    background: active ? '#22c55e' : '#16a34a',
    color: '#000',
    border: 'none',
    padding: '7px 22px',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1.5,
    cursor: active ? 'not-allowed' : 'pointer',
    opacity: active ? 0.6 : 1,
    borderRadius: 2,
  }),
  progressWrap: {
    padding: '12px 24px',
    borderBottom: '1px solid #18181b',
  },
  progressMsg: { fontSize: 11, color: '#52525b', marginBottom: 6 },
  progressBar: { height: 2, background: '#27272a', borderRadius: 1, overflow: 'hidden' },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`, background: '#22c55e', transition: 'width 0.3s ease',
  }),
  body: { padding: '24px' },
  meta: { fontSize: 11, color: '#3f3f46', marginBottom: 20 },
  metaVal: { color: '#22c55e' },
  grid: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860 },
  card: {
    background: '#111113',
    border: '1px solid #1c1c1f',
    borderRadius: 4,
    padding: '16px 20px',
    display: 'grid',
    gridTemplateColumns: '28px 1fr auto',
    gap: 14,
    alignItems: 'start',
  },
  rank: { fontSize: 10, color: '#3f3f46', paddingTop: 3 },
  cardTitle: { fontSize: 13, color: '#f4f4f5', marginBottom: 10, lineHeight: 1.5 },
  tagRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tag: (isYes) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 2,
    letterSpacing: 1,
    background: isYes ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
    color: isYes ? '#22c55e' : '#ef4444',
  }),
  prob: { fontSize: 12, color: '#71717a' },
  whaleCount: { fontSize: 11, color: '#3f3f46' },
  whaleList: { marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' },
  whaleChip: {
    fontSize: 10,
    color: '#52525b',
    textDecoration: 'none',
    padding: '2px 6px',
    background: '#18181b',
    borderRadius: 2,
    border: '1px solid #27272a',
  },
  viewLink: {
    fontSize: 11, color: '#22c55e', textDecoration: 'none', letterSpacing: 1,
    whiteSpace: 'nowrap', paddingTop: 3,
  },
  empty: { color: '#3f3f46', fontSize: 12, maxWidth: 420, lineHeight: 1.7 },
  customSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #18181b',
  },
  addrInput: {
    background: '#18181b',
    border: '1px solid #27272a',
    color: '#e4e4e7',
    padding: '6px 10px',
    fontFamily: 'inherit',
    fontSize: 11,
    width: 340,
    outline: 'none',
    borderRadius: 2,
  },
  addBtn: {
    background: '#27272a',
    color: '#a1a1aa',
    border: 'none',
    padding: '6px 12px',
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
    borderRadius: 2,
  },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  chip: {
    fontSize: 10, color: '#71717a', background: '#18181b',
    border: '1px solid #27272a', padding: '2px 8px', borderRadius: 2,
    cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState('idle'); // idle | loading | done | error
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({ wallets: 0, scanned: 0, hedgers: 0 });
  const [customAddr, setCustomAddr] = useState('');
  const [customWallets, setCustomWallets] = useState([]);

  const [filters, setFilters] = useState({
    minProb: 35,
    maxProb: 65,
    minWallets: 2,
    leaderboardLimit: 50,
    excludeHedgers: true,
  });

  const addCustomWallet = () => {
    const addr = customAddr.trim();
    if (!addr.startsWith('0x') || customWallets.find((w) => w.address === addr)) return;
    setCustomWallets((prev) => [
      ...prev,
      { address: addr, name: shortenAddr(addr), profit: 0 },
    ]);
    setCustomAddr('');
  };

  const run = useCallback(async () => {
    setPhase('loading');
    setProgressPct(0);
    setTrades([]);
    setStats({ wallets: 0, scanned: 0, hedgers: 0 });

    try {
      // 1. Get wallets
      setProgressMsg('Fetching leaderboard...');
      let leaderboard = [];
      if (filters.leaderboardLimit > 0) {
        leaderboard = await getLeaderboard(filters.leaderboardLimit);
      }

      // Merge custom wallets (deduplicate)
      const all = [...leaderboard];
      for (const cw of customWallets) {
        if (!all.find((w) => w.address === cw.address)) all.push(cw);
      }

      if (all.length === 0) {
        setPhase('error');
        setProgressMsg(
          'No wallets to scan. Add custom wallets below or check your internet connection.'
        );
        return;
      }

      setProgressPct(8);

      // 2. Fetch positions per wallet
      const qualified = [];
      let hedgerCount = 0;

      for (let i = 0; i < all.length; i++) {
        const w = all[i];
        setProgressMsg(`Scanning ${i + 1} / ${all.length} — ${w.name}`);

        const positions = await getPositions(w.address);

        if (filters.excludeHedgers && isHedger(positions)) {
          hedgerCount++;
          setProgressPct(8 + ((i + 1) / all.length) * 84);
          await sleep(80);
          continue;
        }

        const filtered = positions.filter((p) =>
          filterPosition(p, { minProb: filters.minProb, maxProb: filters.maxProb })
        );

        if (filtered.length > 0) {
          qualified.push({ ...w, positions: filtered });
        }

        setProgressPct(8 + ((i + 1) / all.length) * 84);
        await sleep(80); // gentle rate limiting
      }

      // 3. Find consensus
      setProgressMsg('Finding consensus...');
      const consensus = getConsensusTrades(qualified, filters.minWallets);

      setStats({ wallets: qualified.length, scanned: all.length, hedgers: hedgerCount });
      setTrades(consensus);
      setPhase('done');
      setProgressPct(100);
    } catch (e) {
      setPhase('error');
      setProgressMsg(e.message);
    }
  }, [filters, customWallets]);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.dot('#22c55e')} />
        <span style={S.title}>POLYMARKET WHALE SCANNER</span>
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        <div style={S.fieldGroup}>
          <span style={S.label}>PROBABILITY RANGE (%)</span>
          <div style={S.row}>
            <input
              type="number" min={1} max={99} value={filters.minProb}
              onChange={(e) => setFilters((f) => ({ ...f, minProb: +e.target.value }))}
              style={S.input}
            />
            <span style={{ color: '#3f3f46' }}>—</span>
            <input
              type="number" min={1} max={99} value={filters.maxProb}
              onChange={(e) => setFilters((f) => ({ ...f, maxProb: +e.target.value }))}
              style={S.input}
            />
          </div>
        </div>

        <div style={S.fieldGroup}>
          <span style={S.label}>MIN WALLETS AGREE</span>
          <input
            type="number" min={1} max={100} value={filters.minWallets}
            onChange={(e) => setFilters((f) => ({ ...f, minWallets: +e.target.value }))}
            style={{ ...S.input, width: 52 }}
          />
        </div>

        <div style={S.fieldGroup}>
          <span style={S.label}>TOP N WALLETS</span>
          <input
            type="number" min={0} max={200} step={10} value={filters.leaderboardLimit}
            onChange={(e) => setFilters((f) => ({ ...f, leaderboardLimit: +e.target.value }))}
            style={{ ...S.input, width: 60 }}
          />
        </div>

        <div style={{ ...S.row, paddingBottom: 2 }}>
          <input
            type="checkbox" id="hedge" checked={filters.excludeHedgers}
            onChange={(e) => setFilters((f) => ({ ...f, excludeHedgers: e.target.checked }))}
            style={{ accentColor: '#22c55e', cursor: 'pointer' }}
          />
          <label htmlFor="hedge" style={S.checkLabel}>Exclude hedgers</label>
        </div>

        <button
          onClick={run}
          disabled={phase === 'loading'}
          style={S.btn(phase === 'loading')}
        >
          {phase === 'loading' ? 'SCANNING…' : 'SCAN'}
        </button>
      </div>

      {/* Custom wallet input */}
      <div style={{ ...S.filterBar, paddingTop: 12, paddingBottom: 14 }}>
        <div style={S.fieldGroup}>
          <span style={S.label}>ADD CUSTOM WALLET</span>
          <div style={S.row}>
            <input
              type="text"
              placeholder="0xabc123…"
              value={customAddr}
              onChange={(e) => setCustomAddr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomWallet()}
              style={S.addrInput}
            />
            <button onClick={addCustomWallet} style={S.addBtn}>ADD</button>
          </div>
          {customWallets.length > 0 && (
            <div style={S.chipRow}>
              {customWallets.map((w) => (
                <span
                  key={w.address}
                  style={S.chip}
                  onClick={() =>
                    setCustomWallets((prev) => prev.filter((x) => x.address !== w.address))
                  }
                  title={`${w.address} — click to remove`}
                >
                  {w.name} ×
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {phase === 'loading' && (
        <div style={S.progressWrap}>
          <div style={S.progressMsg}>{progressMsg}</div>
          <div style={S.progressBar}>
            <div style={S.progressFill(progressPct)} />
          </div>
        </div>
      )}

      {/* Body */}
      <div style={S.body}>
        {phase === 'done' && (
          <>
            <div style={S.meta}>
              Scanned{' '}
              <span style={S.metaVal}>{stats.scanned}</span> wallets —{' '}
              <span style={S.metaVal}>{stats.hedgers}</span> hedgers excluded —{' '}
              <span style={S.metaVal}>{stats.wallets}</span> qualified —{' '}
              <span style={S.metaVal}>{trades.length}</span> consensus trades found
            </div>

            {trades.length === 0 ? (
              <p style={S.empty}>
                No consensus trades found at these settings.
                <br />Try: lowering <strong>Min wallets</strong>, widening the probability range,
                or adding more custom wallets.
              </p>
            ) : (
              <div style={S.grid}>
                {trades.map((trade, i) => (
                  <TradeCard key={`${trade.marketId}_${trade.outcome}`} trade={trade} rank={i + 1} />
                ))}
              </div>
            )}
          </>
        )}

        {phase === 'error' && (
          <p style={{ color: '#ef4444', fontSize: 12 }}>Error: {progressMsg}</p>
        )}

        {phase === 'idle' && (
          <p style={S.empty}>
            Pulls top wallets from the Polymarket leaderboard, filters out hedgers and dead/worthless
            positions, and surfaces markets where multiple whales are betting the same direction —
            near 50/50 probability only.
            <br /><br />
            Set <strong>Top N wallets</strong> to 0 to scan custom wallets only.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Trade card ──────────────────────────────────────────────────────────────

function TradeCard({ trade, rank }) {
  const isYes = trade.outcome === 'Yes';
  const prob = trade.price != null ? Math.round(trade.price * 100) : null;

  return (
    <div style={S.card}>
      <span style={S.rank}>#{rank}</span>

      <div>
        <div style={S.cardTitle}>{trade.title}</div>
        <div style={S.tagRow}>
          <span style={S.tag(isYes)}>{trade.outcome.toUpperCase()}</span>
          {prob != null && (
            <span style={S.prob}>{prob}% probability</span>
          )}
          <span style={S.whaleCount}>{trade.wallets.length} whales</span>
        </div>
        <div style={S.whaleList}>
          {trade.wallets.map((w) => (
            <a
              key={w.address}
              href={`https://polymarket.com/profile/${w.address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={S.whaleChip}
              title={w.address}
            >
              {w.name}
            </a>
          ))}
        </div>
      </div>

      <a
        href={trade.url}
        target="_blank"
        rel="noopener noreferrer"
        style={S.viewLink}
      >
        VIEW →
      </a>
    </div>
  );
}
