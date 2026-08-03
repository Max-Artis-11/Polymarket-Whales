// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 200) {
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
      name: w.userName ?? w.name ?? w.username ?? w.pseudonym ?? shortenAddr(w.proxyWallet ?? w.address ?? ''),
      profit: w.pnl ?? w.profit ?? w.profitAndLoss ?? 0,
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

// ─── Filtering ───────────────────────────────────────────────────────────────

/**
 * Detect TRUE hedgers only.
 * Only flag wallets that hold BOTH Yes AND No on the EXACT same conditionId.
 * Betting NO on lots of things is totally normal on Polymarket — NOT hedging.
 */
export function isHedger(positions) {
  if (!positions.length) return false;

  const seen = {};
  for (const p of positions) {
    const id = p.conditionId;
    if (!id) continue;
    const outcome = p.outcome ?? '';
    if (seen[id] && seen[id] !== outcome) return true;
    seen[id] = outcome;
  }

  return false;
}

/**
 * Filter positions by probability range.
 * Uses curPrice (the actual field from Polymarket API).
 */
export function filterPosition(pos, { minProb = 15, maxProb = 85 } = {}) {
  const price = pos.curPrice ?? pos.price ?? pos.currentPrice ?? pos.avgPrice;
  if (price == null || price <= 0) return false;

  // Filter out resolved markets (price is exactly 1.0 or 0.0 = already settled)
  if (price >= 0.99 || price <= 0.01) return false;

  // Filter out redeemable positions (market is over)
  if (pos.redeemable === true) return false;

  const prob = price * 100;
  if (prob < minProb || prob > maxProb) return false;

  return true;
}

// ─── Consensus ───────────────────────────────────────────────────────────────

export function getConsensusTrades(walletDataList, minWallets = 2) {
  const map = {};

  for (const { address, name, positions } of walletDataList) {
    for (const pos of positions) {
      const marketId = pos.conditionId;
      if (!marketId) continue;

      const key = `${marketId}_${pos.outcome}`;

      if (!map[key]) {
        map[key] = {
          marketId,
          title: pos.title ?? 'Unknown market',
          outcome: pos.outcome ?? '?',
          price: pos.curPrice ?? pos.price ?? null,
          url: pos.eventSlug
            ? `https://polymarket.com/event/${pos.eventSlug}`
            : pos.slug
              ? `https://polymarket.com/event/${pos.slug}`
              : 'https://polymarket.com',
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
