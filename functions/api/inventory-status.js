export async function onRequest(context) {
  const { DB_KV } = context.env;
  
  try {
    // Get all keys from KV
    const list = await DB_KV.list();
    const inventory = {};
    
    // Build inventory object
    for (const key of list.keys) {
      inventory[key.name] = await DB_KV.get(key.name);
    }

    return new Response(JSON.stringify(inventory), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}