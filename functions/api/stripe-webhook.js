// functions/api/stripe-webhook.js
import { productCatalog } from "./_productCatalog";

export async function onRequestPost({ request, env }) {
  const stripeSignature = request.headers.get("stripe-signature");
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  let bodyText;
  try {
    bodyText = await request.text();
  } catch (err) {
    return new Response("Bad request", { status: 400 });
  }

  // TODO: Implement real Stripe signature verification with webhookSecret.
  let event;
  try {
    event = JSON.parse(bodyText);
  } catch (err) {
    console.error("Webhook JSON parse error", err);
    return new Response("Invalid payload", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const productId = session.metadata?.productId;
    const size = session.metadata?.size;

    if (!productId || !size) {
      console.error("Missing metadata on checkout.session.completed");
      return new Response("Missing metadata", { status: 400 });
    }

    const product = productCatalog[productId];
    const sizeInfo = product?.sizeMap?.[size];

    if (!product || !sizeInfo) {
      console.error("Unknown product / size in webhook", productId, size);
      return new Response("Unknown product", { status: 400 });
    }

    await env.PRODUCT_SOLD.put(productId, "sold");

    const customerDetails = session.customer_details || {};
    const address = customerDetails.address || {};

    const orderPayload = {
      recipient: {
        name: customerDetails.name || "One Drop Threads customer",
        address1: address.line1 || "",
        city: address.city || "",
        state_code: address.state || "",
        country_code: address.country || "",
        zip: address.postal_code || "",
        email: customerDetails.email || "",
      },
      items: [
        {
          variant_id: sizeInfo.variantId,
          quantity: 1,
          files: [
            {
              url: product.printFileUrl,
            },
          ],
        },
      ],
      external_id: `ODT-${productId}-${session.id}`,
    };

    try {
      await createPrintfulOrder(env.PRINTFUL_API_KEY, orderPayload);
      console.log("Printful order created for One Drop Threads:", productId, size);
    } catch (err) {
      console.error("Printful order failed:", err);
    }
  }

  return new Response("ok", { status: 200 });
}

async function createPrintfulOrder(apiKey, orderPayload) {
  if (!apiKey) {
    throw new Error("PRINTFUL_API_KEY not set");
  }

  const res = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data;
}
