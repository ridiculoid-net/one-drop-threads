import Stripe from 'stripe';

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const signature = context.request.headers.get('stripe-signature');
  const body = await context.request.text();
  const { STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY, DB_KV } = context.env;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { designId, size, printUrl } = session.metadata;
    const shipping = session.shipping_details;

    // 1. MARK AS SOLD IN DATABASE
    await DB_KV.put(designId, 'sold');

    // 2. MAP SIZE TO PRINTFUL VARIANT ID
    // You need a utility map for this. Example: Bella + Canvas 3001 (Black)
    const variantMap = {
      'S': 4012, 
      'M': 4013, 
      'L': 4014, 
      'XL': 4015, 
      '2XL': 4016 
    };
    const variant_id = variantMap[size] || 4013; // Default to M if fail

    // 3. CREATE ORDER IN PRINTFUL
    const printfulPayload = {
      recipient: {
        name: shipping.name,
        address1: shipping.address.line1,
        address2: shipping.address.line2,
        city: shipping.address.city,
        state_code: shipping.address.state,
        country_code: shipping.address.country,
        zip: shipping.address.postal_code,
      },
      items: [
        {
          variant_id: variant_id, 
          quantity: 1,
          files: [
            {
              // This applies your design to the front of the shirt
              placement: "front", 
              url: printUrl 
            }
          ]
        }
      ]
    };

    await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printfulPayload)
    });
  }

  return new Response('Success', { status: 200 });
}