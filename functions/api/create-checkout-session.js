// functions/api/create-checkout-session.js
import { productCatalog } from "./_productCatalog";

export async function onRequestPost({ request, env }) {
  try {
    const { productId, size } = await request.json();

    if (!productId || !size) {
      return jsonResponse({ error: "Missing productId or size" }, 400);
    }

    const product = productCatalog[productId];
    if (!product) {
      return jsonResponse({ error: "Unknown product" }, 404);
    }

    const sizeInfo = product.sizeMap[size];
    if (!sizeInfo) {
      return jsonResponse({ error: "Size not available for this design" }, 400);
    }

    const soldFlag = await env.PRODUCT_SOLD.get(productId);
    if (soldFlag === "sold") {
      return jsonResponse({ error: "This drop is already sold" }, 409);
    }

    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return jsonResponse({ error: "STRIPE_SECRET_KEY not configured" }, 500);
    }

    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append(
      "success_url",
      `${origin}/success?session_id={CHECKOUT_SESSION_ID}`
    );
    params.append("cancel_url", `${origin}/cancel`);

    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", product.currency);
    params.append(
      "line_items[0][price_data][product_data][name]",
      `One Drop Threads – ${product.name} (size ${size})`
    );
    params.append(
      "line_items[0][price_data][unit_amount]",
      String(product.priceCents)
    );

    params.append("metadata[productId]", productId);
    params.append("metadata[size]", size);

    params.append("shipping_address_collection[allowed_countries][]", "US");
    params.append("shipping_address_collection[allowed_countries][]", "CA");

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("Stripe error:", errorText);
      return jsonResponse(
        { error: "Failed to create Stripe Checkout session" },
        500
      );
    }

    const session = await stripeResponse.json();
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
