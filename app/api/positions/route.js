export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get('user');
  if (!user) return Response.json([]);
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/positions?user=${user}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
