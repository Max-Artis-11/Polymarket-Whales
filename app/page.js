'use client';
import { useState, useCallback, useRef } from 'react';
import {
  getLeaderboard, getPositions, isHedger, filterPosition, getConsensusTrades,
  scoreWallet, getAccountSize, isSportsMarket, shortenAddr, sleep, getMarketCategory,
  calculateConviction,
} from './lib/polymarket';

const SWISSTONY_ADDR = '0x204f72f35326db932158cba6adff0b9a1da95e14';

function NumInput({ value, onChange, min, max, width = 64 }) {
  const [draft, setDraft] = useState(String(value));
  const ref = useRef(null);
  const isFocused = useRef(false);
  const commit = () => {
    let n = parseInt(draft); if (isNaN(n)) n = min ?? 0;
    if (min != null && n < min) n = min; if (max != null && n > max) n = max;
    setDraft(String(n)); onChange(n);
  };
  return (
    <input ref={ref} type="text" inputMode="numeric" value={isFocused.current ? draft : String(value)}
      onFocus={() => { isFocused.current = true; setDraft(String(value)); setTimeout(() => ref.current?.select(), 0); }}
      onBlur={() => { isFocused.current = false; commit(); }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'6px 10px', fontFamily:'inherit', fontSize:12, width, outline:'none', borderRadius:2 }}
    />
  );
}

const S = {
  page: { minHeight:'100vh', fontFamily:"'Geist Mono','Fira Code','Courier New',monospace", fontSize:13 },
  header: { padding:'18px 24px', borderBottom:'1px solid #27272a', display:'flex', alignItems:'center', gap:10 },
  dot: c => ({ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }),
  title: { fontSize:15, fontWeight:700, letterSpacing:3, color:'#f4f4f5' },
  versionWrap: { marginLeft:'auto', position:'relative' },
  versionBtn: { background:'#18181b', border:'1px solid #27272a', color:'#a1a1aa', padding:'5px 12px', fontFamily:'inherit', fontSize:11, cursor:'pointer', borderRadius:2, letterSpacing:1 },
  versionMenu: { position:'absolute', top:'100%', right:0, marginTop:4, background:'#18181b', border:'1px solid #27272a', borderRadius:2, zIndex:100, minWidth:280, overflow:'hidden' },
  versionOption: a => ({ padding:'10px 14px', cursor:'pointer', fontSize:11, color:a?'#22c55e':'#a1a1aa', background:a?'#1c1c1f':'transparent', borderBottom:'1px solid #27272a' }),
  versionDesc: { fontSize:10, color:'#52525b', marginTop:3 },
  filterBar: { padding:'16px 24px', borderBottom:'1px solid #18181b', display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-end' },
  fieldGroup: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:10, color:'#52525b', letterSpacing:1.5 },
  row: { display:'flex', gap:8, alignItems:'center' },
  checkLabel: { fontSize:11, color:'#71717a', cursor:'pointer' },
  select: { background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'6px 10px', fontFamily:'inherit', fontSize:12, outline:'none', borderRadius:2, cursor:'pointer' },
  btn: a => ({ background:a?'#22c55e':'#16a34a', color:'#000', border:'none', padding:'7px 22px', fontFamily:'inherit', fontWeight:700, fontSize:12, letterSpacing:1.5, cursor:a?'not-allowed':'pointer', opacity:a?0.6:1, borderRadius:2 }),
  progressWrap: { padding:'12px 24px', borderBottom:'1px solid #18181b' },
  progressMsg: { fontSize:11, color:'#52525b', marginBottom:6 },
  progressBar: { height:2, background:'#27272a', borderRadius:1, overflow:'hidden' },
  progressFill: p => ({ height:'100%', width:`${p}%`, background:'#22c55e', transition:'width 0.3s ease' }),
  body: { padding:'24px' },
  meta: { fontSize:11, color:'#3f3f46', marginBottom:20 },
  metaVal: { color:'#22c55e' },
  grid: { display:'flex', flexDirection:'column', gap:10, maxWidth:960 },
  card: { background:'#111113', border:'1px solid #1c1c1f', borderRadius:4, padding:'16px 20px', display:'grid', gridTemplateColumns:'28px 1fr auto', gap:14, alignItems:'start' },
  rank: { fontSize:10, color:'#3f3f46', paddingTop:3 },
  cardTitle: { fontSize:13, color:'#f4f4f5', marginBottom:10, lineHeight:1.5 },
  tagRow: { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' },
  tag: y => ({ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:2, letterSpacing:1, background:y?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', color:y?'#22c55e':'#ef4444' }),
  catTag: { fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:2, letterSpacing:1, background:'rgba(139,92,246,0.1)', color:'#8b5cf6' },
  prob: { fontSize:12, color:'#71717a' },
  whaleCount: { fontSize:11, color:'#3f3f46' },
  whaleList: { marginTop:8, display:'flex', gap:8, flexWrap:'wrap' },
  whaleChip: { fontSize:10, color:'#52525b', textDecoration:'none', padding:'2px 6px', background:'#18181b', borderRadius:2, border:'1px solid #27272a' },
  oppSection: { marginTop:8, paddingTop:8, borderTop:'1px solid #1c1c1f' },
  oppLabel: { fontSize:9, color:'#ef4444', letterSpacing:1, marginBottom:4 },
  oppChip: { fontSize:10, color:'#71717a', textDecoration:'none', padding:'2px 6px', background:'rgba(239,68,68,0.05)', borderRadius:2, border:'1px solid #27272a' },
  viewLink: { fontSize:11, color:'#22c55e', textDecoration:'none', letterSpacing:1, whiteSpace:'nowrap', paddingTop:3 },
  empty: { color:'#3f3f46', fontSize:12, maxWidth:480, lineHeight:1.7 },
  addrInput: { background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'6px 10px', fontFamily:'inherit', fontSize:11, width:340, outline:'none', borderRadius:2 },
  addBtn: { background:'#27272a', color:'#a1a1aa', border:'none', padding:'6px 12px', fontFamily:'inherit', fontSize:11, cursor:'pointer', borderRadius:2 },
  chipRow: { display:'flex', gap:6, flexWrap:'wrap', marginTop:6 },
  chip: { fontSize:10, color:'#71717a', background:'#18181b', border:'1px solid #27272a', padding:'2px 8px', borderRadius:2, cursor:'pointer', display:'flex', gap:6, alignItems:'center' },
  scoreExplain: { padding:'12px 24px', borderBottom:'1px solid #18181b', fontSize:10, color:'#52525b', lineHeight:1.6 },
  freqSection: { padding:'24px', borderTop:'1px solid #27272a', marginTop:24 },
  freqTitle: { fontSize:12, color:'#a1a1aa', letterSpacing:1.5, marginBottom:12 },
  freqTable: { width:'100%', maxWidth:700, borderCollapse:'collapse', fontSize:11 },
  freqTh: { textAlign:'left', color:'#52525b', padding:'6px 10px', borderBottom:'1px solid #27272a', fontSize:10, letterSpacing:1 },
  freqTd: { padding:'6px 10px', borderBottom:'1px solid #18181b', color:'#a1a1aa' },
  freqName: { color:'#e4e4e7', textDecoration:'none' },
  convBar: (pct, color) => ({ width:80, height:6, background:'#27272a', borderRadius:3, overflow:'hidden', display:'inline-block', verticalAlign:'middle', marginLeft:6 }),
  convFill: (pct, color) => ({ height:'100%', width:`${pct}%`, background:color, borderRadius:3 }),
  gradeTag: (grade) => {
    const colors = { A:'#22c55e', B:'#3b82f6', C:'#eab308', D:'#f97316', F:'#ef4444' };
    return { fontSize:11, fontWeight:900, padding:'2px 8px', borderRadius:2, background:`${colors[grade]||'#ef4444'}22`, color:colors[grade]||'#ef4444', letterSpacing:1 };
  },
  reasonsList: { marginTop:6, fontSize:10, color:'#52525b', lineHeight:1.6 },
  v8Card: { background:'#111113', border:'1px solid #1c1c1f', borderRadius:4, padding:'14px 18px', marginBottom:8 },
  v8Title: { fontSize:12, color:'#f4f4f5', marginBottom:4 },
  v8Meta: { fontSize:10, color:'#52525b' },
  v8Size: { fontSize:11, color:'#22c55e', fontWeight:700 },
};

export default function Home() {
  const [version, setVersion] = useState('v5');
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({ wallets:0, scanned:0, hedgers:0 });
  const [customAddr, setCustomAddr] = useState('');
  const [customWallets, setCustomWallets] = useState([]);
  const [freqMin, setFreqMin] = useState(2);
  const [v8Positions, setV8Positions] = useState([]);
  const [v8Score, setV8Score] = useState(null);
  const [v9MinConviction, setV9MinConviction] = useState(40);

  const [filters, setFilters] = useState({
    minProb:15, maxProb:85, minWallets:2, leaderboardLimit:200,
    excludeHedgers:true, category:'all', accountSize:'all',
    v7Category:'all_v7', v8Category:'all_v7',
  });

  const addCustomWallet = () => {
    const addr = customAddr.trim();
    if (!addr.startsWith('0x') || customWallets.find(w => w.address === addr)) return;
    setCustomWallets(prev => [...prev, { address:addr, name:shortenAddr(addr), profit:0, volume:0 }]);
    setCustomAddr('');
  };

  // V8: Swisstony scan
  const runV8 = useCallback(async () => {
    setPhase('loading'); setProgressPct(0); setV8Positions([]); setV8Score(null);
    setProgressMsg('Fetching swisstony positions...');
    try {
      const positions = await getPositions(SWISSTONY_ADDR);
      setProgressPct(50);
      const score = scoreWallet(positions, 0, 0);
      setV8Score(score);
      // Filter by category + prob range
      const filtered = positions.filter(p => {
        const price = p.curPrice ?? p.price ?? p.currentPrice ?? p.avgPrice;
        if (price == null || price <= 0 || price >= 0.99 || price <= 0.01) return false;
        if (p.redeemable) return false;
        const prob = price * 100;
        if (prob < filters.minProb || prob > filters.maxProb) return false;
        const cat = getMarketCategory(p.title ?? '');
        if (filters.v8Category === 'all_v7') return cat !== 'other';
        return cat === filters.v8Category;
      });
      // Sort by position size
      filtered.sort((a, b) => ((b.size ?? b.currentValue ?? 0) - (a.size ?? a.currentValue ?? 0)));
      setV8Positions(filtered);
      setPhase('done'); setProgressPct(100);
    } catch (e) { setPhase('error'); setProgressMsg(e.message); }
  }, [filters]);

  // V5/V6/V7/V9 scan
  const run = useCallback(async () => {
    if (version === 'v8') { runV8(); return; }
    setPhase('loading'); setProgressPct(0); setTrades([]); setStats({ wallets:0, scanned:0, hedgers:0 });
    try {
      setProgressMsg('Fetching leaderboard...');
      let leaderboard = filters.leaderboardLimit > 0 ? await getLeaderboard(filters.leaderboardLimit) : [];
      const all = [...leaderboard];
      for (const cw of customWallets) { if (!all.find(w => w.address === cw.address)) all.push(cw); }
      if (!all.length) { setPhase('error'); setProgressMsg('No wallets to scan.'); return; }
      setProgressPct(8);

      const qualified = [];
      const allWalletPositions = [];
      let hedgerCount = 0;
      const isScored = version !== 'v5';
      const BATCH = 100;

      for (let b = 0; b < all.length; b += BATCH) {
        const batch = all.slice(b, b + BATCH);
        setProgressMsg(`${isScored ? 'Scoring' : 'Scanning'} ${Math.min(b + BATCH, all.length)} / ${all.length}...`);
        const results = await Promise.all(batch.map(async w => {
          const positions = await getPositions(w.address);
          return { ...w, positions };
        }));

        for (const w of results) {
          if (filters.excludeHedgers && isHedger(w.positions)) { hedgerCount++; continue; }

          let walletScore = null;
          if (isScored) {
            walletScore = scoreWallet(w.positions, w.profit, w.volume);
            if (walletScore && filters.accountSize !== 'all') {
              if (getAccountSize(w.volume) !== filters.accountSize) continue;
            }
            if (walletScore && walletScore.totalPositions >= 5 && walletScore.realWinRate < 30) continue;
          }

          const filterOpts = { minProb:filters.minProb, maxProb:filters.maxProb };
          if (version === 'v5' || version === 'v6') filterOpts.category = filters.category;
          if (version === 'v7' || version === 'v9') filterOpts.v7Category = filters.v7Category;

          const filtered = w.positions.filter(p => filterPosition(p, filterOpts));

          if (version === 'v7' || version === 'v9') {
            allWalletPositions.push({ address:w.address, name:w.name, allPositions:w.positions, walletScore });
          }

          if (filtered.length > 0) {
            qualified.push({ ...w, positions:filtered, walletScore });
          }
        }
        setProgressPct(8 + (Math.min(b + BATCH, all.length) / all.length) * 84);
      }

      setProgressMsg('Finding consensus...');
      let consensus = getConsensusTrades(qualified, filters.minWallets,
        (version === 'v7' || version === 'v9') ? allWalletPositions : null);

      // V9: sort by conviction and filter
      if (version === 'v9') {
        consensus = consensus
          .filter(t => t.convictionData && t.convictionData.conviction >= v9MinConviction)
          .sort((a, b) => (b.convictionData?.conviction ?? 0) - (a.convictionData?.conviction ?? 0));
      }

      setStats({ wallets:qualified.length, scanned:all.length, hedgers:hedgerCount });
      setTrades(consensus); setPhase('done'); setProgressPct(100);
    } catch (e) { setPhase('error'); setProgressMsg(e.message); }
  }, [filters, customWallets, version, v9MinConviction, runV8]);

  // Frequency table for v7
  const walletFreq = {};
  if (version === 'v7' && trades.length) {
    for (const t of trades) {
      for (const w of t.wallets) {
        if (!walletFreq[w.address]) walletFreq[w.address] = { name:w.name, address:w.address, score:w.score, count:0 };
        walletFreq[w.address].count++;
      }
    }
  }
  const freqList = Object.values(walletFreq).filter(w => w.count >= freqMin).sort((a,b) => b.count - a.count);

  const showScore = version !== 'v5';
  const showOpposing = version === 'v7' || version === 'v9';
  const showSize = version === 'v7' || version === 'v9';
  const showConviction = version === 'v9';

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.dot(version === 'v9' ? '#3b82f6' : version === 'v8' ? '#f59e0b' : '#22c55e')} />
        <span style={S.title}>POLYMARKET WHALE SCANNER</span>
        <div style={S.versionWrap}>
          <button style={S.versionBtn} onClick={() => setVersionMenuOpen(v => !v)}>
            {version.toUpperCase()} ▾
          </button>
          {versionMenuOpen && (
            <div style={S.versionMenu}>
              {[
                ['v5','BASIC','Raw whale consensus. No scoring.'],
                ['v6','SCORED','Win rate scoring, account size filter.'],
                ['v7','SPORTS FOCUS','Tennis, Esports & Baseball. Opposing bets, position sizes.'],
                ['v8','SWISSTONY','Track swisstony\'s live positions by category.'],
                ['v9','CONVICTION','Algorithm-ranked trades. Filters by probability zone, specialist money, quality whales, opposition.'],
              ].map(([v,label,desc]) => (
                <div key={v} style={S.versionOption(version===v)} onClick={() => { setVersion(v); setVersionMenuOpen(false); }}>
                  {v.toUpperCase()} — {label}<div style={S.versionDesc}>{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* V7 score explanation */}
      {version === 'v7' && phase !== 'loading' && (
        <div style={S.scoreExplain}>
          <strong style={{color:'#a1a1aa'}}>HOW SCORES WORK</strong> — Each whale gets a score out of 100 based on: real win rate (dead positions count as losses), entry difficulty (buying at 50/50 scores higher than 90/10 favourites), and account size bonus (small accounts with high win rates get boosted). Trade score = average of all whale scores on that trade.
        </div>
      )}

      {/* V9 explanation */}
      {version === 'v9' && phase !== 'loading' && (
        <div style={{...S.scoreExplain, borderLeft:'3px solid #3b82f6', marginLeft:0}}>
          <strong style={{color:'#3b82f6'}}>CONVICTION ALGORITHM</strong> — Backtested on 27 trades (14W/13L → filtered to 71% in sweet spot). Scores each trade 0-100 based on: probability sweet spot (25-55%), quality whale count (40%+ win rate only), specialist big money ($5k+), high-score whale concentration, opposing whale penalty, and dollar-weighted consensus. Grades: A (70+), B (55+), C (40+), D (25+), F (&lt;25).
        </div>
      )}

      <div style={S.filterBar}>
        {version !== 'v8' && (<>
          <div style={S.fieldGroup}>
            <span style={S.label}>PROBABILITY RANGE (%)</span>
            <div style={S.row}>
              <NumInput value={filters.minProb} min={1} max={99} width={64} onChange={v => setFilters(f => ({...f, minProb:v}))} />
              <span style={{color:'#3f3f46'}}>—</span>
              <NumInput value={filters.maxProb} min={1} max={99} width={64} onChange={v => setFilters(f => ({...f, maxProb:v}))} />
            </div>
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>MIN WALLETS AGREE</span>
            <NumInput value={filters.minWallets} min={1} max={100} width={52} onChange={v => setFilters(f => ({...f, minWallets:v}))} />
          </div>
          <div style={S.fieldGroup}>
            <span style={S.label}>TOP N WALLETS</span>
            <NumInput value={filters.leaderboardLimit} min={0} max={1000} width={64} onChange={v => setFilters(f => ({...f, leaderboardLimit:v}))} />
          </div>
          <div style={{...S.row, paddingBottom:2}}>
            <input type="checkbox" id="hedge" checked={filters.excludeHedgers}
              onChange={e => setFilters(f => ({...f, excludeHedgers:e.target.checked}))}
              style={{accentColor:'#22c55e', cursor:'pointer'}} />
            <label htmlFor="hedge" style={S.checkLabel}>Exclude hedgers</label>
          </div>
        </>)}

        {version === 'v8' && (
          <div style={S.fieldGroup}>
            <span style={S.label}>PROBABILITY RANGE (%)</span>
            <div style={S.row}>
              <NumInput value={filters.minProb} min={1} max={99} width={64} onChange={v => setFilters(f => ({...f, minProb:v}))} />
              <span style={{color:'#3f3f46'}}>—</span>
              <NumInput value={filters.maxProb} min={1} max={99} width={64} onChange={v => setFilters(f => ({...f, maxProb:v}))} />
            </div>
          </div>
        )}

        {(version === 'v5' || version === 'v6') && (
          <div style={S.fieldGroup}>
            <span style={S.label}>CATEGORY</span>
            <select value={filters.category} onChange={e => setFilters(f => ({...f, category:e.target.value}))} style={S.select}>
              <option value="all">All markets</option>
              <option value="sports">Sports & Esports only</option>
            </select>
          </div>
        )}

        {(version === 'v7' || version === 'v9') && (
          <div style={S.fieldGroup}>
            <span style={S.label}>SPORT</span>
            <select value={filters.v7Category} onChange={e => setFilters(f => ({...f, v7Category:e.target.value}))} style={S.select}>
              <option value="all_v7">Tennis + Esports + Baseball</option>
              <option value="tennis">Tennis only</option>
              <option value="esports">Esports only</option>
              <option value="baseball">Baseball only</option>
            </select>
          </div>
        )}

        {version === 'v8' && (
          <div style={S.fieldGroup}>
            <span style={S.label}>CATEGORY</span>
            <select value={filters.v8Category} onChange={e => setFilters(f => ({...f, v8Category:e.target.value}))} style={S.select}>
              <option value="all_v7">All Sports</option>
              <option value="tennis">Tennis</option>
              <option value="esports">Esports</option>
              <option value="baseball">Baseball</option>
            </select>
          </div>
        )}

        {(version === 'v6' || version === 'v7' || version === 'v9') && (
          <div style={S.fieldGroup}>
            <span style={S.label}>ACCOUNT SIZE</span>
            <select value={filters.accountSize} onChange={e => setFilters(f => ({...f, accountSize:e.target.value}))} style={S.select}>
              <option value="all">All accounts</option>
              <option value="whale">Whales (&gt;$500k)</option>
              <option value="mid">Mid ($50k–$500k)</option>
              <option value="small">Small (&lt;$50k)</option>
            </select>
          </div>
        )}

        {version === 'v9' && (
          <div style={S.fieldGroup}>
            <span style={S.label}>MIN CONVICTION</span>
            <NumInput value={v9MinConviction} min={0} max={100} width={52} onChange={setV9MinConviction} />
          </div>
        )}

        <button onClick={run} disabled={phase==='loading'} style={S.btn(phase==='loading')}>
          {phase==='loading' ? 'SCANNING…' : 'SCAN'}
        </button>
      </div>

      {/* Custom wallet (not v8) */}
      {version !== 'v8' && (
        <div style={{...S.filterBar, paddingTop:12, paddingBottom:14}}>
          <div style={S.fieldGroup}>
            <span style={S.label}>ADD CUSTOM WALLET</span>
            <div style={S.row}>
              <input type="text" placeholder="0xabc123…" value={customAddr}
                onChange={e => setCustomAddr(e.target.value)} onKeyDown={e => e.key==='Enter' && addCustomWallet()}
                style={S.addrInput} />
              <button onClick={addCustomWallet} style={S.addBtn}>ADD</button>
            </div>
            {customWallets.length > 0 && (
              <div style={S.chipRow}>{customWallets.map(w => (
                <span key={w.address} style={S.chip}
                  onClick={() => setCustomWallets(prev => prev.filter(x => x.address !== w.address))}
                  title={`${w.address} — click to remove`}>{w.name} ×</span>
              ))}</div>
            )}
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div style={S.progressWrap}>
          <div style={S.progressMsg}>{progressMsg}</div>
          <div style={S.progressBar}><div style={S.progressFill(progressPct)} /></div>
        </div>
      )}

      <div style={S.body}>
        {/* V8 Swisstony results */}
        {phase === 'done' && version === 'v8' && (<>
          <div style={S.meta}>
            <span style={{color:'#f59e0b', fontWeight:700}}>SWISSTONY</span> — {' '}
            <span style={S.metaVal}>{v8Positions.length}</span> active positions
            {v8Score && (<> — Win rate: <span style={S.metaVal}>{v8Score.realWinRate}%</span> — Score: <span style={S.metaVal}>{v8Score.score}/100</span> — {v8Score.wins}W/{v8Score.losses}L</>)}
          </div>
          <div style={S.grid}>
            {v8Positions.map((p, i) => {
              const price = p.curPrice ?? p.price ?? 0;
              const prob = Math.round(price * 100);
              const size = p.size ?? p.currentValue ?? p.initialValue ?? 0;
              const isYes = (p.outcome ?? '') === 'Yes';
              const cat = getMarketCategory(p.title ?? '');
              const catLabels = { tennis:'TENNIS', esports:'ESPORTS', baseball:'BASEBALL' };
              return (
                <div key={`${p.conditionId}_${p.outcome}_${i}`} style={S.v8Card}>
                  <div style={S.v8Title}>{p.title ?? 'Unknown'}</div>
                  <div style={{...S.tagRow, marginTop:6}}>
                    <span style={S.tag(isYes)}>{(p.outcome ?? '?').toUpperCase()}</span>
                    <span style={S.prob}>{prob}%</span>
                    {size > 0 && <span style={S.v8Size}>${Math.round(size).toLocaleString()}</span>}
                    {catLabels[cat] && <span style={S.catTag}>{catLabels[cat]}</span>}
                    <a href={p.eventSlug ? `https://polymarket.com/event/${p.eventSlug}` : '#'}
                      target="_blank" rel="noopener noreferrer" style={S.viewLink}>VIEW →</a>
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* V5/V6/V7/V9 results */}
        {phase === 'done' && version !== 'v8' && (<>
          <div style={S.meta}>
            Scanned <span style={S.metaVal}>{stats.scanned}</span> wallets —{' '}
            <span style={S.metaVal}>{stats.hedgers}</span> hedgers excluded —{' '}
            <span style={S.metaVal}>{stats.wallets}</span> qualified —{' '}
            <span style={S.metaVal}>{trades.length}</span> {version === 'v9' ? `trades (conviction ≥ ${v9MinConviction})` : 'consensus trades found'}
          </div>
          {trades.length === 0 ? (
            <p style={S.empty}>No {version === 'v9' ? `trades above conviction ${v9MinConviction}` : 'consensus trades found'}. Try widening filters.</p>
          ) : (
            <div style={S.grid}>{trades.map((t,i) => (
              <TradeCard key={`${t.marketId}_${t.outcome}`} trade={t} rank={i+1}
                showScore={showScore} showOpposing={showOpposing}
                showSize={showSize} showConviction={showConviction} />
            ))}</div>
          )}

          {/* V7 frequency table */}
          {version === 'v7' && trades.length > 0 && (
            <div style={S.freqSection}>
              <div style={{display:'flex', gap:16, alignItems:'center', marginBottom:16}}>
                <span style={S.freqTitle}>WHALE FREQUENCY</span>
                <div style={S.fieldGroup}>
                  <span style={S.label}>MIN APPEARANCES</span>
                  <NumInput value={freqMin} min={1} max={50} width={48} onChange={setFreqMin} />
                </div>
              </div>
              {freqList.length === 0 ? <p style={S.empty}>No wallets with {freqMin}+ appearances.</p> : (
                <table style={S.freqTable}>
                  <thead><tr>
                    <th style={S.freqTh}>WALLET</th><th style={S.freqTh}>APPEARANCES</th>
                    <th style={S.freqTh}>WIN RATE</th><th style={S.freqTh}>SCORE</th>
                  </tr></thead>
                  <tbody>{freqList.map(w => (
                    <tr key={w.address}>
                      <td style={S.freqTd}><a href={`https://polymarket.com/profile/${w.address}`} target="_blank" rel="noopener noreferrer" style={S.freqName}>{w.name}</a></td>
                      <td style={S.freqTd}>{w.count}</td>
                      <td style={S.freqTd}>{w.score?.realWinRate ?? '—'}%</td>
                      <td style={S.freqTd}>{w.score?.score ?? '—'}/100</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </>)}
        {phase === 'error' && <p style={{color:'#ef4444', fontSize:12}}>Error: {progressMsg}</p>}
        {phase === 'idle' && (
          <p style={S.empty}>
            {version === 'v5' ? 'Raw whale consensus. No scoring, no filters beyond probability range.' :
             version === 'v6' ? 'Scored mode — detects win rate manipulation, rewards harder trades, filters by account size.' :
             version === 'v7' ? 'Sports focus — Tennis, Esports & Baseball only. Shows opposing bets, position sizes, and whale frequency.' :
             version === 'v8' ? 'Swisstony tracker — shows all of swisstony\'s live positions filtered by sport category.' :
             'Conviction algorithm — ranks trades by a composite score based on probability zone, specialist money, quality whales, and opposition. Backtested: 25-55% zone hits 71%.'}
          </p>
        )}
      </div>
    </div>
  );
}

function TradeCard({ trade, rank, showScore, showOpposing, showSize, showConviction }) {
  const isYes = trade.outcome === 'Yes';
  const prob = trade.price != null ? Math.round(trade.price * 100) : null;
  const scoreColor = trade.avgScore >= 60 ? '#22c55e' : trade.avgScore >= 40 ? '#eab308' : '#ef4444';
  const catLabels = { tennis:'TENNIS', esports:'ESPORTS', baseball:'BASEBALL' };
  const cd = trade.convictionData;
  const convColor = cd ? (cd.conviction >= 70 ? '#22c55e' : cd.conviction >= 55 ? '#3b82f6' : cd.conviction >= 40 ? '#eab308' : cd.conviction >= 25 ? '#f97316' : '#ef4444') : '#3f3f46';

  return (
    <div style={{...S.card, borderLeft: showConviction && cd ? `3px solid ${convColor}` : undefined}}>
      <span style={S.rank}>#{rank}</span>
      <div>
        <div style={S.cardTitle}>{trade.title}</div>
        <div style={S.tagRow}>
          <span style={S.tag(isYes)}>{trade.outcome.toUpperCase()}</span>
          {prob != null && <span style={S.prob}>{prob}%</span>}
          <span style={S.whaleCount}>{trade.wallets.length} whales</span>
          {showScore && <span style={{fontSize:10, fontWeight:700, color:scoreColor}}>SCORE {trade.avgScore}/100</span>}
          {trade.category && catLabels[trade.category] && <span style={S.catTag}>{catLabels[trade.category]}</span>}
          {showConviction && cd && (<>
            <span style={S.gradeTag(cd.grade)}>{cd.grade}</span>
            <span style={{fontSize:10, fontWeight:700, color:convColor}}>CONV {cd.conviction}/100</span>
            <span style={S.convBar(cd.conviction, convColor)}><span style={S.convFill(cd.conviction, convColor)} /></span>
          </>)}
        </div>

        {/* Conviction reasons */}
        {showConviction && cd && cd.reasons.length > 0 && (
          <div style={S.reasonsList}>
            {cd.reasons.map((r, i) => (
              <span key={i} style={{marginRight:10}}>• {r}</span>
            ))}
            {cd.forDollars > 0 && (
              <span style={{marginRight:10}}>• ${Math.round(cd.forDollars/1000)}k FOR vs ${Math.round(cd.againstDollars/1000)}k AGAINST</span>
            )}
          </div>
        )}

        <div style={S.whaleList}>{trade.wallets.map(w => {
          const s = w.score;
          const sizeStr = showSize && w.positionSize ? ` $${Math.round(w.positionSize)}` : '';
          const tip = s
            ? `${w.address}\nWin rate: ${s.realWinRate}% (${s.wins}W/${s.losses}L)\nAvg entry: ${s.avgEntryProb}%\nDead: ${s.deadPositions}\nCrypto: ${s.cryptoRatio}%\nScore: ${s.score}/100`
            : w.address;
          return (
            <a key={w.address} href={`https://polymarket.com/profile/${w.address}`} target="_blank"
              rel="noopener noreferrer" style={S.whaleChip} title={tip}>
              {w.name} {showScore && s ? `(${s.score}/100)` : ''}{sizeStr}
            </a>
          );
        })}</div>

        {showOpposing && trade.opposingWallets && trade.opposingWallets.length > 0 && (
          <div style={S.oppSection}>
            <div style={S.oppLabel}>▼ {trade.opposingWallets.length} BETTING AGAINST</div>
            <div style={S.whaleList}>{trade.opposingWallets.map(w => {
              const s = w.score;
              const sizeStr = showSize && w.positionSize ? ` $${Math.round(w.positionSize)}` : '';
              const tip = s ? `${w.address}\nScore: ${s.score}/100\nWin rate: ${s.realWinRate}%` : w.address;
              return (
                <a key={w.address} href={`https://polymarket.com/profile/${w.address}`} target="_blank"
                  rel="noopener noreferrer" style={S.oppChip} title={tip}>
                  {w.name} {s ? `(${s.score}/100)` : ''}{sizeStr}
                </a>
              );
            })}</div>
          </div>
        )}
      </div>
      <a href={trade.url} target="_blank" rel="noopener noreferrer" style={S.viewLink}>VIEW →</a>
    </div>
  );
}
