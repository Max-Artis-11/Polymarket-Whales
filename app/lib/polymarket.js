// ——— Fetchers ————————————————————————————————————————————————————

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

// ——— Wallet Scoring ——————————————————————————————————————————————

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

// ——— Category Detection —————————————————————————————————————————

const SPORTS_PATTERNS = /\b(vs\.?|match|winner|game \d|map \d|bo[135]|o\/u|over\/under|spread|handicap|score|goals?|sets?|kills?)\b/i;
const SPORTS_LEAGUES = /\b(nba|nfl|mlb|nhl|mls|epl|la liga|serie a|bundesliga|ligue 1|atp|wta|ufc|mma|nascar|f1|formula|cricket|wnba|kbo|npb|lol|dota|counter-strike|csgo|cs2|valorant|overwatch|league of legends|esports?|e-sports?|rainbow six)\b/i;
const SPORTS_TERMS = /\b(fc |cf |sc |united|city fc|rovers|athletic|racing|tigers|eagles|giants|cardinals|yankees|dodgers|braves|cubs|phillies|orioles|rays|guardians|twins|reds|pirates|brewers|padres|diamondbacks|nationals|mets|marlins|rockies|astros|rangers|royals|mariners|angels|white sox|red sox|blue jays|storm|liberty|fever|aces|sparks|mercury|sky |lynx|mystics|sun |wings|dream|falcons|betboom|fnatic|mouz|basement boys|fire flux|arcred|butterfly|nongshim|hanwha|gen\.g|t1 |sk nebula|fokus|ruddy sack|deer gaming|estral|team solid|vici gaming|yakult|pegula|eala|fritz|kawa|fruhvirtova|berrettini|borges|kecmanovic|zheng|barrena|skatov|duckworth|oconnell|boisson|ruzic|putintseva|zhang|navone|korneeva|galarneau|kovacevic)\b/i;

const TENNIS_PATTERNS = /\b(atp|wta|open|slam|set handicap|sets?|match point|ace|serve|deuce|tiebreak|challenger|itf)\b/i;
const TENNIS_NAMES = /\b(pegula|eala|fritz|kawa|fruhvirtova|berrettini|borges|kecmanovic|zheng|barrena|skatov|duckworth|oconnell|boisson|ruzic|putintseva|zhang|navone|korneeva|galarneau|kovacevic|pliskova|kalinina|bondar|kostovic|kubka|muller|basing|ratti|berkieta|mena|frech|jeanjean|jones|tararudee|vukic|altmaier|parry|day|landaluce|mejia|sorger|kopp|andreescu|bartunkova|bellucci|baez|kopriva|draxl|aguilar|sonego|moutet|medvedev|sinner|djokovic|alcaraz|nadal|swiatek|sabalenka|rybakina|gauff|osaka|federer|searle|harris|vandromme|valdmannova|samson|barthel|galfi|seidel|sierra|stephens|stearns|kessler|brace|sramkova|blinkova|gibson|cocciaretto|cross|boulter|diallo|jacquet|fucsovics|assche|droguet|duran|ghibaudo|milev|batalla|aboian|jover|pankin|sun |wallberg|vogt|okalova|catanzarite)\b/i;
const TENNIS_VENUES = /\b(warsaw|istanbul|hagen|grodzisk|plovdiv|wimbledon|roland garros|us open|australian open|indian wells|miami open|rome|madrid|montreal|cincinnati|mubadala|citi dc|canadian open|national bank open|hamburg|beijing|shanghai|tokyo|lexington|landisville|leipzig)\b/i;

const ESPORTS_PATTERNS = /\b(lol|dota|counter-strike|csgo|cs2|valorant|overwatch|rainbow six|siege|league of legends|bo[135]|map \d|game \d winner|total kills|esport|e-sport)\b/i;
const ESPORTS_TEAMS = /\b(natus vincere|navi|fnatic|mouz|gen\.g|t1 |hanwha|nongshim|sk nebula|fokus|team falcons|betboom|vici gaming|yakult|ruddy sack|deer gaming|estral|team solid|basement boys|fire flux|arcred|butterfly|leo team|inner circle|oddik|isurus|sparta|young ninjas|metizport|johnny speeds|shifters|gentle mates|karmine corp|bulldog|verdant|zeu5|3v team|amaru|team jenz|dplus|varrel|walczaki|rustec|genone|unity esports|imperial|procyon|borracheiros|keyd|spirit academy|lph gaming|noir verse|bushido wildcats|wbt)\b/i;

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

// ——— Filtering ———————————————————————————————————————————————————

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

  if (v7Category) {
    const cat = getMarketCategory(pos.title ?? '');
    if (v7Category === 'all_v7') {
      if (cat === 'other') return false;
    } else if (cat !== v7Category) {
      return false;
    }
  }

  const prob = price * 100;
  if (prob < minProb || prob > maxProb) return false;
  return true;
}

// ——— V9 Conviction Algorithm ————————————————————————————————————

export function calculateConviction(trade) {
  const prob = trade.price != null ? trade.price * 100 : 50;
  let conviction = 0;
  let reasons = [];

  // 1. PROBABILITY SWEET SPOT (25-55% = best zone from backtesting)
  if (prob >= 25 && prob <= 55) {
    conviction += 25;
    reasons.push('Sweet spot (25-55%)');
  } else if (prob >= 15 && prob < 25) {
    conviction += 10;
    reasons.push('Moderate underdog');
  } else if (prob > 55 && prob <= 70) {
    conviction += 10;
    reasons.push('Slight favourite');
  } else if (prob < 10) {
    conviction -= 20;
    reasons.push('DANGER: Extreme longshot (<10%)');
  } else if (prob > 85) {
    conviction -= 15;
    reasons.push('DANGER: Heavy favourite (>85%)');
  }

  // 2. QUALITY WHALE COUNT (only whales with >40% win rate)
  const qualityWhales = trade.wallets.filter(w => {
    const wr = w.score?.realWinRate ?? 0;
    return wr >= 40;
  });
  const qCount = qualityWhales.length;
  const qPoints = Math.min(qCount * 3, 20);
  conviction += qPoints;
  if (qCount >= 5) reasons.push(`${qCount} quality whales (40%+ WR)`);

  // 3. SPECIALIST BIG MONEY (any single position >= $5k)
  const bigPositions = trade.wallets.filter(w => (w.positionSize ?? 0) >= 5000);
  if (bigPositions.length > 0) {
    const maxPos = Math.max(...bigPositions.map(w => w.positionSize ?? 0));
    conviction += 15;
    reasons.push(`$${Math.round(maxPos / 1000)}k specialist position`);
    if (bigPositions.length >= 2) {
      conviction += 5;
      reasons.push(`${bigPositions.length} big-money whales`);
    }
  }

  // 4. HIGH-SCORE WHALE CONCENTRATION
  const highScoreWhales = trade.wallets.filter(w => (w.score?.score ?? 0) >= 55);
  if (highScoreWhales.length >= 2) {
    conviction += 10;
    reasons.push(`${highScoreWhales.length} high-score (55+) whales`);
  }

  // 5. OPPOSING WHALE PENALTY
  const oppCount = (trade.opposingWallets ?? []).length;
  const oppHighScore = (trade.opposingWallets ?? []).filter(w => (w.score?.score ?? 0) >= 55).length;
  if (oppCount > 0) {
    conviction -= oppCount * 3;
    reasons.push(`${oppCount} opposing whale(s)`);
  }
  if (oppHighScore > 0) {
    conviction -= oppHighScore * 5;
    reasons.push(`${oppHighScore} high-score opposing`);
  }

  // 6. DOLLAR-WEIGHTED CONSENSUS
  const forDollars = trade.wallets.reduce((s, w) => s + (w.positionSize ?? 0), 0);
  const againstDollars = (trade.opposingWallets ?? []).reduce((s, w) => s + (w.positionSize ?? 0), 0);
  if (forDollars > 0 && againstDollars > 0) {
    const ratio = forDollars / (forDollars + againstDollars);
    if (ratio < 0.6) {
      conviction -= 10;
      reasons.push('Weak $ ratio vs opposition');
    } else if (ratio > 0.85) {
      conviction += 5;
      reasons.push('Strong $ dominance');
    }
  }

  // 7. MINIMUM WHALE THRESHOLD
  if (trade.wallets.length < 3) {
    conviction -= 10;
    reasons.push('Low whale count (<3)');
  }

  // Clamp 0-100
  conviction = Math.max(0, Math.min(100, conviction));

  // Grade
  let grade = 'F';
  if (conviction >= 70) grade = 'A';
  else if (conviction >= 55) grade = 'B';
  else if (conviction >= 40) grade = 'C';
  else if (conviction >= 25) grade = 'D';

  return { conviction, grade, reasons, qualityWhaleCount: qCount, bigMoneyCount: bigPositions.length, forDollars, againstDollars };
}

// ——— Consensus ———————————————————————————————————————————————————

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

  if (allWalletPositions) {
    for (const trade of Object.values(map)) {
      const oppositeOutcome = trade.outcome === 'Yes' ? 'No' : 'Yes';
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
      t.convictionData = calculateConviction(t);
      return t;
    })
    .sort((a, b) => {
      if (b.wallets.length !== a.wallets.length) return b.wallets.length - a.wallets.length;
      return b.avgScore - a.avgScore;
    });
  return results;
}

// ——— Helpers —————————————————————————————————————————————————————

export function shortenAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
