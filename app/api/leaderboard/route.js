export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000);

  try {
    // Polymarket caps at ~50 per request, so paginate
    const batchSize = 50;
    let all = [];
    let offset = 0;

    while (all.length < limit) {
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?window=all&limit=${batchSize}&offset=${offset}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) break;
      const batch = await res.json();
      const items = Array.isArray(batch) ? batch : [];
      if (items.length === 0) break;
      all = all.concat(items);
      offset += batchSize;
      if (items.length < batchSize) break; // no more pages
    }

    return Response.json(all.slice(0, limit));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
