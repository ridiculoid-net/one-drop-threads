export async function onRequest(context) {
  // DB_KV is the binding name you set in Cloudflare dashboard
  const { DB_KV } = context.env; 
  
  // Fetch all keys (simplistic approach for small inventory)
  const list = await DB_KV.list();
  const inventory = {};
  
  for (const key of list.keys) {
    inventory[key.name] = await DB_KV.get(key.name);
  }

  return new Response(JSON.stringify(inventory), {
    headers: { 'Content-Type': 'application/json' }
  });
}