import Stripe from 'stripe';

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const { request, env } = context;
  const body = await request.json();
  const { designId, size, title, price, printUrl, sizeMap } = body;

  // 1. Double Check Availability (Race Condition Protection)
  const status = await env.DB_KV.get(designId);
  if (status === 'sold') {
    return new Response(JSON.stringify({ error: 'Sorry, this item just sold!' }), { status: 400 });
  }

  // 2. Get the correct variant ID for this size in the mockup's color
  const variantId = sizeMap[size];
  if (!variantId) {
    return new Response(JSON.stringify({ error: 'Size not available' }), { status: 400 });
  }

  // 3. Calculate shipping (free over $100)
  const SHIPPING_COST = 500; // $5.00
  const FREE_SHIPPING_THRESHOLD = 10000; // $100.00
  const shippingAmount = price >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  // 4. Build line items
  const lineItems = [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${title} (Size: ${size})`,
          images: [printUrl],
          metadata: {
              designId: designId,
              one_of_one: "true"
          }
        },
        unit_amount: price,
      },
      quantity: 1,
    }
  ];

  // Add shipping if not free
  if (shippingAmount > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Shipping & Handling',
          description: 'Standard shipping (5-7 business days)'
        },
        unit_amount: shippingAmount,
      },
      quantity: 1,
    });
  }

  // 5. Create Stripe Session
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      // Pass vital info to webhook via metadata
      metadata: {
        designId: designId,
        size: size,
        printUrl: printUrl,
        variantId: variantId // The exact variant that matches the mockup
      },
      success_url: `${new URL(request.url).origin}/?success=true`,
      cancel_url: `${new URL(request.url).origin}/`,
      shipping_address_collection: {
        allowed_countries: ['US'], // US only
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}