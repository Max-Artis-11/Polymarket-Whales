export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '50';

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/leaderboard?window=all&limit=${limit}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
