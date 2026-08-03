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
      volume: w.vol ?? w.volume ?? 0,
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

// ─── Wallet Scoring ──────────────────────────────────────────────────────────

const CRYPTO_PRICE_PATTERNS = /\b(btc|bitcoin|eth|ethereum|solana|sol|xrp|doge|bnb|cardano|ada)\b.*\b(hit|reach|dip|above|below|price)\b/i;
const CRYPTO_TITLE_PATTERNS = /will (btc|bitcoin|eth|ethereum|solana?|sol |xrp|doge)/i;

export function isCryptoTrade(title) {
  return CRYPTO_PRICE_PATTERNS.test(title) || CRYPTO_TITLE_PATTERNS.test(title);
}

export function scoreWallet(positions, walletProfit = 0, walletVolume = 0) {
  if (!positions.length) return null;
  let wins = 0, losses = 0, dead = 0, cryptoCount = 0, entryProbSum = 0, entryProbCount = 0;
  for (const p of positions) {
    const curPrice = p.curPrice ?? 0;
    const initialValue = p.initialValue ?? 0;
    const currentValue = p.currentValue ?? 0;
    const cashPnl = p.cashPnl ?? 0;
    if (isCryptoTrade(p.title ?? '')) cryptoCount++;
    const avgPrice = p.avgPrice ?? 0;
    if (avgPrice > 0 && avgPrice < 1) { entryProbSum += avgPrice; entryProbCount++; }
    if (p.redeemable || curPrice >= 0.99 || curPrice <= 0.01) {
      if (cashPnl > 0 || currentValue > initialValue * 1.1) wins++; else losses++;
      continue;
    }
    if (initialValue > 0 && currentValue < initialValue * 0.1) { dead++; losses++; continue; }
    if (cashPnl > 0 || currentValue > initialValue) wins++; else losses++;
  }
  const total = wins + losses;
  const realWinRate = total > 0 ? wins / total : 0;
  const avgEntryProb = entryProbCount > 0 ? entryProbSum / entryProbCount : 0.5;
  const cryptoRatio = positions.length > 0 ? cryptoCount / positions.length : 0;
  let score = realWinRate * 100;
  const difficultyBonus = 1 - Math.abs(avgEntryProb - 0.5) * 2;
  score *= (0.7 + difficultyBonus * 0.3);
  const deadRatio = total > 0 ? dead / total : 0;
  score *= (1 - deadRatio * 0.5);
  if (cryptoRatio > 0.5) score *= 0.3;
  if (walletVolume > 0 && walletVolume < 50000 && realWinRate > 0.55) score *= 1.2;
  if (total < 5) score *= 0.5;
  return {
    score: Math.round(score), realWinRate: Math.round(realWinRate * 100),
    avgEntryProb: Math.round(avgEntryProb * 100), isCryptoHeavy: cryptoRatio > 0.5,
    deadPositions: dead, totalPositions: total, wins, losses,
    cryptoRatio: Math.round(cryptoRatio * 100), volume: walletVolume,
  };
}

export function getAccountSize(volume) {
  if (volume > 500000) return 'whale';
  if (volume > 50000) return 'mid';
  return 'small';
}

// ─── Category Detection ─────────────────────────────────────────────────────

const SPORTS_PATTERNS = /\b(vs\.?|match|winner|game \d|map \d|bo[135]|o\/u|over\/under|spread|handicap|score|goals?|sets?|kills?)\b/i;
const SPORTS_LEAGUES = /\b(nba|nfl|mlb|nhl|mls|epl|la liga|serie a|bundesliga|ligue 1|atp|wta|ufc|mma|nascar|f1|formula|cricket|wnba|kbo|npb|lol|dota|counter-strike|csgo|cs2|valorant|overwatch|league of legends|esports?|e-sports?|rainbow six)\b/i;
const SPORTS_TERMS = /\b(fc |cf |sc |united|city fc|rovers|athletic|racing|tigers|eagles|giants|cardinals|yankees|dodgers|braves|cubs|phillies|orioles|rays|guardians|twins|reds|pirates|brewers|padres|diamondbacks|nationals|mets|marlins|rockies|astros|rangers|royals|mariners|angels|white sox|red sox|blue jays|storm|liberty|fever|aces|sparks|mercury|sky |lynx|mystics|sun |wings|dream|falcons|betboom|fnatic|mouz|basement boys|fire flux|arcred|butterfly|nongshim|hanwha|gen\.g|t1 |sk nebula|fokus|ruddy sack|deer gaming|estral|team solid|vici gaming|yakult|pegula|eala|fritz|kawa|fruhvirtova|berrettini|borges|kecmanovic|zheng|barrena|skatov|duckworth|oconnell|boisson|ruzic|putintseva|zhang|navone|korneeva|galarneau|kovacevic)\b/i;

const TENNIS_PATTERNS = /\b(atp|wta|open|slam|set handicap|sets?|match point|ace|serve|deuce|tiebreak|challenger|itf)\b/i;
const TENNIS_NAMES = /\b(pegula|eala|fritz|kawa|fruhvirtova|berrettini|borges|kecmanovic|zheng|barrena|skatov|duckworth|oconnell|boisson|ruzic|putintseva|zhang|navone|korneeva|galarneau|kovacevic|pliskova|kalinina|bondar|kostovic|kubka|muller|basing|ratti|berkieta|mena|frech|jeanjean|jones|tararudee|vukic|altmaier|parry|day|landaluce|mejia|sorger|kopp|andreescu|bartunkova|bellucci|baez|kopriva|draxl|aguilar|sonego|moutet|medvedev|sinner|djokovic|alcaraz|nadal|swiatek|sabalenka|rybakina|gauff|osaka|federer)\b/i;
const TENNIS_VENUES = /\b(warsaw|istanbul|hagen|grodzisk|plovdiv|wimbledon|roland garros|us open|australian open|indian wells|miami open|rome|madrid|montreal|cincinnati|mubadala|citi dc|canadian open|national bank open|hamburg|beijing|shanghai|tokyo)\b/i;

const ESPORTS_PATTERNS = /\b(lol|dota|counter-strike|csgo|cs2|valorant|overwatch|rainbow six|siege|league of legends|bo[135]|map \d|game \d winner|total kills|esport|e-sport)\b/i;
const ESPORTS_TEAMS = /\b(natus vincere|navi|fnatic|mouz|gen\.g|t1 |hanwha|nongshim|sk nebula|fokus|team falcons|betboom|vici gaming|yakult|ruddy sack|deer gaming|estral|team solid|basement boys|fire flux|arcred|butterfly|leo team|inner circle|oddik|isurus|sparta|young ninjas|metizport|johnny speeds|shifters|gentle mates|karmine corp|bulldog|verdant|zeu5|3v team|amaru|team jenz|dplus|varrel)\b/i;

const BASEBALL_PATTERNS = /\b(mlb|kbo|npb|innings?|pitcher|batting|home run|strikeout|rbi|era|world series|american league|national league|championship series)\b/i;
const BASEBALL_TEAMS = /\b(yankees|dodgers|braves|cubs|phillies|orioles|rays|guardians|twins|reds|pirates|brewers|padres|diamondbacks|nationals|mets|marlins|rockies|astros|rangers|royals|mariners|angels|white sox|red sox|blue jays|cardinals|giants|tigers|athletics|tampa bay|cleveland|detroit|baltimore|philadelphia|chicago|st\. louis|san francisco|san diego|arizona|colorado|pittsburgh|milwaukee|houston|seattle|minnesota|kansas city|los angeles|new york|boston|toronto|washington|cincinnati|atlanta|texas|samsung lions|lotte giants|kia tigers|nc dinos|hanwha eagles|lg twins|kt wiz|kiwoom heroes)\b/i;

export function isSportsMarket(title) {
  if (!title) return false;
  return SPORTS_PATTERNS.test(title) || SPORTS_LEAGUES.test(title) || SPORTS_TERMS.test(title);
}

export function isTennisMarket(title) {
  if (!title) return false;
  return TENNIS_PATTERNS.test(title) || TENNIS_NAMES.test(title) || TENNIS_VENUES.test(title);
}

export function isEsportsMarket(title) {
  if (!title) return false;
  return ESPORTS_PATTERNS.test(title) || ESPORTS_TEAMS.test(title);
}

export function isBaseballMarket(title) {
  if (!title) return false;
  return BASEBALL_PATTERNS.test(title) || BASEBALL_TEAMS.test(title);
}

export function getMarketCategory(title) {
  if (isTennisMarket(title)) return 'tennis';
  if (isEsportsMarket(title)) return 'esports';
  if (isBaseballMarket(title)) return 'baseball';
  return 'other';
}

// ─── Filtering ───────────────────────────────────────────────────────────────

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

export function filterPosition(pos, { minProb = 15, maxProb = 85, category = 'all', v7Category = null } = {}) {
  const price = pos.curPrice ?? pos.price ?? pos.currentPrice ?? pos.avgPrice;
  if (price == null || price <= 0) return false;
  if (price >= 0.99 || price <= 0.01) return false;
  if (pos.redeemable === true) return false;

  if (category === 'sports' && !isSportsMarket(pos.title ?? '')) return false;

  // V7 specific category filtering
  if (v7Category) {
    const cat = getMarketCategory(pos.title ?? '');
    if (v7Category === 'all_v7') {
      if (cat === 'other') return false; // must be tennis, esports, or baseball
    } else if (cat !== v7Category) {
      return false;
    }
  }

  const prob = price * 100;
  if (prob < minProb || prob > maxProb) return false;
  return true;
}

// ─── Consensus ───────────────────────────────────────────────────────────────

export function getConsensusTrades(walletDataList, minWallets = 2, allWalletPositions = null) {
  const map = {};

  for (const { address, name, positions, walletScore } of walletDataList) {
    for (const pos of positions) {
      const marketId = pos.conditionId;
      if (!marketId) continue;
      const key = `${marketId}_${pos.outcome}`;
      if (!map[key]) {
        map[key] = {
          marketId, title: pos.title ?? 'Unknown market',
          outcome: pos.outcome ?? '?',
          price: pos.curPrice ?? pos.price ?? null,
          url: pos.eventSlug
            ? `https://polymarket.com/event/${pos.eventSlug}`
            : pos.slug ? `https://polymarket.com/event/${pos.slug}` : 'https://polymarket.com',
          wallets: [], opposingWallets: [], avgScore: 0,
        };
      }
      if (!map[key].wallets.find((w) => w.address === address)) {
        const size = pos.size ?? pos.initialValue ?? pos.currentValue ?? null;
        map[key].wallets.push({ address, name, score: walletScore, positionSize: size });
      }
    }
  }

  // Find opposing wallets
  if (allWalletPositions) {
    for (const trade of Object.values(map)) {
      const oppositeOutcome = trade.outcome === 'Yes' ? 'No' : 'Yes';
      const oppKey = `${trade.marketId}_${oppositeOutcome}`;
      // Search all wallet positions for opposing bets
      for (const { address, name, allPositions, walletScore } of allWalletPositions) {
        for (const pos of allPositions) {
          if ((pos.conditionId === trade.marketId) && (pos.outcome === oppositeOutcome)) {
            if (!trade.opposingWallets.find((w) => w.address === address)) {
              const size = pos.size ?? pos.initialValue ?? pos.currentValue ?? null;
              trade.opposingWallets.push({ address, name, score: walletScore, positionSize: size });
            }
          }
        }
      }
    }
  }

  const results = Object.values(map)
    .filter((t) => t.wallets.length >= minWallets)
    .map((t) => {
      const scores = t.wallets.map((w) => w.score?.score ?? 0);
      t.avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      t.category = getMarketCategory(t.title);
      return t;
    })
    .sort((a, b) => {
      if (b.wallets.length !== a.wallets.length) return b.wallets.length - a.wallets.length;
      return b.avgScore - a.avgScore;
    });
  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function shortenAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
