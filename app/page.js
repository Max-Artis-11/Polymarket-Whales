'use client';

import { useState, useCallback, useRef } from 'react';
import {
  getLeaderboard,
  getPositions,
  isHedger,
  filterPosition,
  getConsensusTrades,
  scoreWallet,
  getAccountSize,
  shortenAddr,
  sleep,
} from './lib/polymarket';

// ─── Number input that doesn't fight you ─────────────────────────────────────

function NumInput({ value, onChange, min, max, width = 64, style = {} }) {
  const [draft, setDraft] = useState(String(value));
  const ref = useRef(null);

  const commit = () => {
    let n = parseInt(draft);
    if (isNaN(n)) n = min ?? 0;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    setDraft(String(n));
    onChange(n);
  };

  // Sync from parent when not focused
  const isFocused = useRef(false);
  if (!isFocused.current && String(value) !== draft) {
    // only sync if we're not editing
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={() => { isFocused.current = true; ref.current?.select(); }}
      onBlur={() => { isFocused.current = false; commit(); }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      style={{
        background: '#18181b',
        border: '1px solid #27272a',
        color: '#e4e4e7',
        padding: '6px 10px',
        fontFamily: 'inherit',
        fontSize: 12,
        width,
        outline: 'none',
        borderRadius: 2,
        ...style,
      }}
    />
  );
}

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
  versionWrap: {
    marginLeft: 'auto', position: 'relative',
  },
  versionBtn: {
    background: '#18181b',
    border: '1px solid #27272a',
    color: '#a1a1aa',
    padding: '5px 12px',
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
    borderRadius: 2,
    letterSpacing: 1,
  },
  versionMenu: {
    position: 'absolute', top: '100%', right: 0, marginTop: 4,
    background: '#18181b', border: '1px solid #27272a', borderRadius: 2,
    zIndex: 100, minWidth: 200, overflow: 'hidden',
  },
  versionOption: (active) => ({
    padding: '10px 14px', cursor: 'pointer', fontSize: 11,
    color: active ? '#22c55e' : '#a1a1aa',
    background: active ? '#1c1c1f' : 'transparent',
    borderBottom: '1px solid #27272a',
  }),
  versionDesc: { fontSize: 10, color: '#52525b', marginTop: 3 },
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
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  checkLabel: { fontSize: 11, color: '#71717a', cursor: 'pointer' },
  select: {
    background: '#18181b',
    border: '1px solid #27272a',
    color: '#e4e4e7',
    padding: '6px 10px',
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
    borderRadius: 2,
    cursor: 'pointer',
  },
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
  progressWrap: { padding: '12px 24px', borderBottom: '1px solid #18181b' },
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
    background: '#111113', border: '1px solid #1c1c1f', borderRadius: 4,
    padding: '16px 20px', display: 'grid',
    gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'start',
  },
  rank: { fontSize: 10, color: '#3f3f46', paddingTop: 3 },
  cardTitle: { fontSize: 13, color: '#f4f4f5', marginBottom: 10, lineHeight: 1.5 },
  tagRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tag: (isYes) => ({
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 2, letterSpacing: 1,
    background: isYes ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
    color: isYes ? '#22c55e' : '#ef4444',
  }),
  prob: { fontSize: 12, color: '#71717a' },
  whaleCount: { fontSize: 11, color: '#3f3f46' },
  whaleList: { marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' },
  whaleChip: {
    fontSize: 10, color: '#52525b', textDecoration: 'none',
    padding: '2px 6px', background: '#18181b', borderRadius: 2, border: '1px solid #27272a',
  },
  viewLink: {
    fontSize: 11, color: '#22c55e', textDecoration: 'none', letterSpacing: 1,
    whiteSpace: 'nowrap', paddingTop: 3,
  },
  empty: { color: '#3f3f46', fontSize: 12, maxWidth: 420, lineHeight: 1.7 },
  addrInput: {
    background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7',
    padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, width: 340,
    outline: 'none', borderRadius: 2,
  },
  addBtn: {
    background: '#27272a', color: '#a1a1aa', border: 'none',
    padding: '6px 12px', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', borderRadius: 2,
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
  const [version, setVersion] = useState('v5');
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({ wallets: 0, scanned: 0, hedgers: 0 });
  const [customAddr, setCustomAddr] = useState('');
  const [customWallets, setCustomWallets] = useState([]);

  const [filters, setFilters] = useState({
    minProb: 15,
    maxProb: 85,
    minWallets: 2,
    leaderboardLimit: 200,
    excludeHedgers: true,
    // v6 only
    accountSize: 'all', // all | whale | small | mid
  });

  const addCustomWallet = () => {
    const addr = customAddr.trim();
    if (!addr.startsWith('0x') || customWallets.find((w) => w.address === addr)) return;
    setCustomWallets((prev) => [
      ...prev,
      { address: addr, name: shortenAddr(addr), profit: 0, volume: 0 },
    ]);
    setCustomAddr('');
  };

  const run = useCallback(async () => {
    setPhase('loading');
    setProgressPct(0);
    setTrades([]);
    setStats({ wallets: 0, scanned: 0, hedgers: 0 });

    try {
      setProgressMsg('Fetching leaderboard...');
      let leaderboard = [];
      if (filters.leaderboardLimit > 0) {
        leaderboard = await getLeaderboard(filters.leaderboardLimit);
      }

      const all = [...leaderboard];
      for (const cw of customWallets) {
        if (!all.find((w) => w.address === cw.address)) all.push(cw);
      }

      if (all.length === 0) {
        setPhase('error');
        setProgressMsg('No wallets to scan. Add custom wallets below or check your internet connection.');
        return;
      }

      setProgressPct(8);

      const qualified = [];
      let hedgerCount = 0;

      if (version === 'v5') {
        // ─── V5: fire all position fetches in parallel batches of 20 ───
        const BATCH = 20;
        for (let b = 0; b < all.length; b += BATCH) {
          const batch = all.slice(b, b + BATCH);
          setProgressMsg(`Scanning ${Math.min(b + BATCH, all.length)} / ${all.length}...`);

          const results = await Promise.all(
            batch.map(async (w) => {
              const positions = await getPositions(w.address);
              return { ...w, positions };
            })
          );

          for (const w of results) {
            if (filters.excludeHedgers && isHedger(w.positions)) {
              hedgerCount++;
              continue;
            }
            const filtered = w.positions.filter((p) =>
              filterPosition(p, { minProb: filters.minProb, maxProb: filters.maxProb })
            );
            if (filtered.length > 0) {
              qualified.push({ ...w, positions: filtered, walletScore: null });
            }
          }

          setProgressPct(8 + (Math.min(b + BATCH, all.length) / all.length) * 84);
        }
      } else {
        // ─── V6: parallel fetch, then score ───
        const BATCH = 20;
        for (let b = 0; b < all.length; b += BATCH) {
          const batch = all.slice(b, b + BATCH);
          setProgressMsg(`Scoring ${Math.min(b + BATCH, all.length)} / ${all.length}...`);

          const results = await Promise.all(
            batch.map(async (w) => {
              const positions = await getPositions(w.address);
              return { ...w, positions };
            })
          );

          for (const w of results) {
            if (filters.excludeHedgers && isHedger(w.positions)) {
              hedgerCount++;
              continue;
            }

            const walletScore = scoreWallet(w.positions, w.profit, w.volume);

            if (walletScore && filters.accountSize !== 'all') {
              const size = getAccountSize(w.volume);
              if (size !== filters.accountSize) continue;
            }

            if (walletScore && walletScore.totalPositions >= 5 && walletScore.realWinRate < 30) continue;

            const filtered = w.positions.filter((p) =>
              filterPosition(p, { minProb: filters.minProb, maxProb: filters.maxProb })
            );

            if (filtered.length > 0) {
              qualified.push({ ...w, positions: filtered, walletScore });
            }
          }

          setProgressPct(8 + (Math.min(b + BATCH, all.length) / all.length) * 84);
        }
      }

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
  }, [filters, customWallets, version]);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.dot('#22c55e')} />
        <span style={S.title}>POLYMARKET WHALE SCANNER</span>

        {/* Version dropdown */}
        <div style={S.versionWrap}>
          <button
            style={S.versionBtn}
            onClick={() => setVersionMenuOpen((v) => !v)}
          >
            {version.toUpperCase()} ▾
          </button>
          {versionMenuOpen && (
            <div style={S.versionMenu}>
              <div
                style={S.versionOption(version === 'v5')}
                onClick={() => { setVersion('v5'); setVersionMenuOpen(false); }}
              >
                V5 — BASIC
                <div style={S.versionDesc}>Raw whale consensus. No scoring, no filters beyond probability range.</div>
              </div>
              <div
                style={S.versionOption(version === 'v6')}
                onClick={() => { setVersion('v6'); setVersionMenuOpen(false); }}
              >
                V6 — SCORED
                <div style={S.versionDesc}>Win rate manipulation detection, entry quality scoring, account size filter.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        <div style={S.fieldGroup}>
          <span style={S.label}>PROBABILITY RANGE (%)</span>
          <div style={S.row}>
            <NumInput
              value={filters.minProb} min={1} max={99} width={64}
              onChange={(v) => setFilters((f) => ({ ...f, minProb: v }))}
            />
            <span style={{ color: '#3f3f46' }}>—</span>
            <NumInput
              value={filters.maxProb} min={1} max={99} width={64}
              onChange={(v) => setFilters((f) => ({ ...f, maxProb: v }))}
            />
          </div>
        </div>

        <div style={S.fieldGroup}>
          <span style={S.label}>MIN WALLETS AGREE</span>
          <NumInput
            value={filters.minWallets} min={1} max={100} width={52}
            onChange={(v) => setFilters((f) => ({ ...f, minWallets: v }))}
          />
        </div>

        <div style={S.fieldGroup}>
          <span style={S.label}>TOP N WALLETS</span>
          <NumInput
            value={filters.leaderboardLimit} min={0} max={500} width={64}
            onChange={(v) => setFilters((f) => ({ ...f, leaderboardLimit: v }))}
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

        {/* v6-only: account size filter */}
        {version === 'v6' && (
          <div style={S.fieldGroup}>
            <span style={S.label}>ACCOUNT SIZE</span>
            <select
              value={filters.accountSize}
              onChange={(e) => setFilters((f) => ({ ...f, accountSize: e.target.value }))}
              style={S.select}
            >
              <option value="all">All accounts</option>
              <option value="whale">Whales only (&gt;$500k)</option>
              <option value="mid">Mid ($50k–$500k)</option>
              <option value="small">Small (&lt;$50k)</option>
            </select>
          </div>
        )}

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
                  <TradeCard
                    key={`${trade.marketId}_${trade.outcome}`}
                    trade={trade}
                    rank={i + 1}
                    showScore={version === 'v6'}
                  />
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
            {version === 'v5' ? (
              <>
                Pulls top wallets from the Polymarket leaderboard, filters out hedgers and
                resolved positions, and surfaces markets where multiple whales are betting
                the same direction.
              </>
            ) : (
              <>
                V6 adds wallet scoring — detects win rate manipulation (dead positions left open),
                rewards harder trades near 50/50, and lets you filter by account size.
                Hover any whale chip to see their full stats.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Trade card ──────────────────────────────────────────────────────────────

function TradeCard({ trade, rank, showScore }) {
  const isYes = trade.outcome === 'Yes';
  const prob = trade.price != null ? Math.round(trade.price * 100) : null;
  const scoreColor = trade.avgScore >= 60 ? '#22c55e' : trade.avgScore >= 40 ? '#eab308' : '#ef4444';

  return (
    <div style={S.card}>
      <span style={S.rank}>#{rank}</span>

      <div>
        <div style={S.cardTitle}>{trade.title}</div>
        <div style={S.tagRow}>
          <span style={S.tag(isYes)}>{trade.outcome.toUpperCase()}</span>
          {prob != null && <span style={S.prob}>{prob}%</span>}
          <span style={S.whaleCount}>{trade.wallets.length} whales</span>
          {showScore && (
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor }}>
              SCORE {trade.avgScore}
            </span>
          )}
        </div>
        <div style={S.whaleList}>
          {trade.wallets.map((w) => {
            const s = w.score;
            const tip = s
              ? `${w.address}\nWin rate: ${s.realWinRate}% (${s.wins}W/${s.losses}L)\nAvg entry: ${s.avgEntryProb}%\nDead positions: ${s.deadPositions}\nCrypto heavy: ${s.isCryptoHeavy ? 'Yes' : 'No'} (${s.cryptoRatio}%)\nScore: ${s.score}`
              : w.address;
            return (
              <a
                key={w.address}
                href={`https://polymarket.com/profile/${w.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={S.whaleChip}
                title={tip}
              >
                {w.name} {showScore && s ? `(${s.realWinRate}%)` : ''}
              </a>
            );
          })}
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
