export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user') || '';

  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${user}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
