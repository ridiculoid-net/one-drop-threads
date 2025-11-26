import Stripe from 'stripe';

export async function onRequest(context) {
  // Only allow POST requests
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const signature = context.request.headers.get('stripe-signature');
  const body = await context.request.text();
  const { STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY, DB_KV } = context.env;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { designId, size, printUrl } = session.metadata;
    const shipping = session.shipping_details;

    // Validate required data
    if (!designId || !size || !printUrl || !shipping) {
      console.error('Missing required metadata or shipping details');
      return new Response('Missing required data', { status: 400 });
    }

    try {
      // 1. MARK AS SOLD IN DATABASE
      await DB_KV.put(designId, 'sold');

      // 2. MAP SIZE TO PRINTFUL VARIANT ID
      const variantMap = {
        'S': 4012, 
        'M': 4013, 
        'L': 4014, 
        'XL': 4015, 
        '2XL': 4016 
      };
      const variant_id = variantMap[size] || 4013;

      // 3. CREATE ORDER IN PRINTFUL
      const printfulPayload = {
        recipient: {
          name: shipping.name,
          address1: shipping.address.line1,
          address2: shipping.address.line2 || '',
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
                placement: "front", 
                url: printUrl 
              }
            ]
          }
        ]
      };

      const printfulResponse = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(printfulPayload)
      });

      if (!printfulResponse.ok) {
        const errorText = await printfulResponse.text();
        console.error('Printful API error:', errorText);
        return new Response('Printful error logged', { status: 200 });
      }

    } catch (err) {
      console.error('Error processing webhook:', err);
      return new Response('Error logged', { status: 200 });
    }
  }
  // Log other event types but return success
  else {
    console.log(`Received event type: ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}