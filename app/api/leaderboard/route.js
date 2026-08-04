export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '200');
  const all = [];
  const PER_PAGE = 50;
  const pages = Math.ceil(Math.min(limit, 1000) / PER_PAGE);
  for (let i = 0; i < pages; i++) {
    try {
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?limit=${PER_PAGE}&offset=${i * PER_PAGE}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.data ?? data?.results ?? [];
      if (!items.length) break;
      all.push(...items);
    } catch { break; }
  }
  return Response.json(all.slice(0, limit));
}
