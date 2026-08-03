const DATA_API = 'https://data-api.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 50) {
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeLeaderboard(raw);
  } catch (e) {
    console.warn('Leaderboard fetch failed:', e.message);
    return [];
  }
}

function normalizeLeaderboard(data) {
  const items = Array.isArray(data)
    ? data
    : data?.data ?? data?.results ?? data?.leaderboard ?? data?.traders ?? [];

  return items
    .map((w) => ({
      address: w.proxyWallet ?? w.address ?? w.wallet ?? w.user ?? '',
      name:
        w.name ??
        w.username ??
        w.pseudonym ??
        shortenAddr(w.proxyWallet ?? w.address ?? ''),
      profit: w.profit ?? w.profitAndLoss ?? w.pnl ?? 0,
    }))
    .filter((w) => w.address.startsWith('0x'));
}

export async function getPositions(address) {
  try {
    const res = await fetch(`/api/positions?user=${address}`);
    if (!res.ok) return [];
    const raw = await res.json();
    return Array.isArray(raw) ? raw : raw?.data ?? raw?.positions ?? [];
  } catch {
    return [];
  }
}

export async function getProfit(address) {
  try {
    const res = await fetch(`${DATA_API}/profit?user=${address}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Filtering ───────────────────────────────────────────────────────────────

/**
 * Detect hedger wallets.
 *
 * Two patterns to catch:
 *  1. Direct hedge: same conditionId with BOTH Yes and No positions.
 *  2. Tournament hedge: lots of NO positions (>= 5) that outnumber YES by 3:1
 *     — typical "bet NO on every team except the one you like" strategy.
 */
export function isHedger(positions) {
  if (!positions.length) return false;

  // Pattern 1 — same market, both outcomes
  const seen = {};
  for (const p of positions) {
    const id = p.conditionId ?? p.market ?? p.asset;
    if (!id) continue;
    if (seen[id] && seen[id] !== p.outcome) return true; // both yes and no
    seen[id] = p.outcome;
  }

  // Pattern 2 — heavy NO dominance
  const nos = positions.filter((p) => p.outcome === 'No').length;
  const yes = positions.filter((p) => p.outcome === 'Yes').length;
  if (nos >= 5 && nos / (yes || 1) >= 3) return true;

  return false;
}

/**
 * Filter an individual position.
 * Rules:
 *  - Price must exist and be in [minProb%, maxProb%]
 *  - Current value must be at least 10% of initial (not a dead bet)
 */
export function filterPosition(pos, { minProb = 35, maxProb = 65 } = {}) {
  const price = pos.price ?? pos.currentPrice ?? pos.pricePerShare;
  if (!price || price <= 0 || price >= 1) return false;

  const prob = price * 100;
  if (prob < minProb || prob > maxProb) return false;

  // Dead position check — current value < 10% of what was paid
  const paid = pos.initialValue ?? pos.size ?? pos.cost;
  const now = pos.currentValue ?? pos.cashBalance ?? pos.value;
  if (paid > 0 && now !== undefined && now / paid < 0.1) return false;

  return true;
}

// ─── Consensus ───────────────────────────────────────────────────────────────

/**
 * Aggregate filtered positions across all wallets.
 * Returns trades that >= minWallets agree on, sorted by agreement count.
 */
export function getConsensusTrades(walletDataList, minWallets = 2) {
  const map = {};

  for (const { address, name, positions } of walletDataList) {
    for (const pos of positions) {
      const marketId = pos.conditionId ?? pos.market ?? pos.asset;
      if (!marketId) continue;

      const key = `${marketId}_${pos.outcome}`;

      if (!map[key]) {
        const slug = pos.slug ?? pos.marketSlug ?? pos.eventSlug;
        map[key] = {
          marketId,
          title: pos.title ?? pos.question ?? pos.name ?? 'Unknown market',
          outcome: pos.outcome,
          price: pos.price ?? pos.currentPrice ?? null,
          url: slug
            ? `https://polymarket.com/event/${slug}`
            : `https://polymarket.com`,
          wallets: [],
        };
      }

      if (!map[key].wallets.find((w) => w.address === address)) {
        map[key].wallets.push({ address, name });
      }
    }
  }

  return Object.values(map)
    .filter((t) => t.wallets.length >= minWallets)
    .sort((a, b) => b.wallets.length - a.wallets.length);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function shortenAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
