import Stripe from 'stripe';

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const { request, env } = context;
  const body = await request.json();
  const { designId, size, title, price, printUrl } = body;

  // 1. Double Check Availability (Race Condition Protection)
  const status = await env.DB_KV.get(designId);
  if (status === 'sold') {
    return new Response(JSON.stringify({ error: 'Sorry, this item just sold!' }), { status: 400 });
  }

  // 2. Create Stripe Session
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${title} (Size: ${size})`,
            images: [printUrl], // Use mock image or printUrl
            metadata: {
                designId: designId,
                one_of_one: "true"
            }
          },
          unit_amount: price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // Pass vital info to webhook via metadata
      metadata: {
        designId: designId,
        size: size,
        printUrl: printUrl // Used to fulfill order
      },
      success_url: `${new URL(request.url).origin}/?success=true`,
      cancel_url: `${new URL(request.url).origin}/`,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB'], // Add your shipping zones
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}