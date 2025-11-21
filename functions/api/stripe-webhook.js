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
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ⭐ Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { designId, size, printUrl } = session.metadata;
    const shipping = session.shipping_details;

    console.log(`🎉 Sale completed! Design: ${designId}, Size: ${size}`);

    // 1. ⭐ MARK AS SOLD (This is the magic!)
    await DB_KV.put(designId, 'sold');
    console.log(`✅ Marked ${designId} as SOLD`);

    // 2. Create Printful Order
    try {
      const variantMap = {
        'S': 4012, 
        'M': 4013, 
        'L': 4014, 
        'XL': 4015, 
        '2XL': 4016 
      };

      const printfulOrder = {
        recipient: {
          name: shipping.name,
          address1: shipping.address.line1,
          address2: shipping.address.line2 || '',
          city: shipping.address.city,
          state_code: shipping.address.state,
          country_code: shipping.address.country,
          zip: shipping.address.postal_code,
        },
        items: [{
          variant_id: variantMap[size] || 4013,
          quantity: 1,
          files: [{
            type: 'default',
            url: printUrl
          }]
        }]
      };

      const printfulResponse = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(printfulOrder)
      });

      const printfulData = await printfulResponse.json();
      
      if (printfulData.result?.id) {
        console.log(`✅ Printful order created: ${printfulData.result.id}`);
        
        // Auto-confirm order
        await fetch(`https://api.printful.com/orders/${printfulData.result.id}/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PRINTFUL_API_KEY}`
          }
        });
        
        console.log(`✅ Printful order confirmed`);
      }
    } catch (printfulError) {
      console.error('Printful error:', printfulError);
      // Don't fail the webhook - item is still marked as sold
    }
  }

  return new Response('Success', { status: 200 });
}