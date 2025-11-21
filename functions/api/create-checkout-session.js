import Stripe from 'stripe';

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { priceId, designId, size, printUrl } = body;

    // ⭐ KEY PART: Check if already sold
    const status = await env.DB_KV.get(designId);
    if (status === 'sold') {
      return new Response(JSON.stringify({ 
        error: 'Sorry! This design just sold out. It was truly 1 of 1.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create checkout with Stripe Product Price
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price: priceId,  // ← Your Stripe Price ID
        quantity: 1,
      }],
      mode: 'payment',
      
      // Pass important data to webhook
      metadata: {
        designId: designId,
        size: size,
        printUrl: printUrl
      },
      
      success_url: `${new URL(request.url).origin}/?success=true&design=${designId}`,
      cancel_url: `${new URL(request.url).origin}/`,
      
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ'],
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ 
      error: err.message || 'Failed to create checkout' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// CORS support
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}