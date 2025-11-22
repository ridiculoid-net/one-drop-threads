// tools/add-product-from-template.js
//
// Store API–adapted version
//
// Usage example:
//   node tools/add-product-from-template.js \
//     --store-id 17262304 \
//     --product-id 123456 \
//     --slug one-drop-midnight-grid \
//     --name "Midnight Grid" \
//     --price 4200
//
// Notes:
// - --store-id is your Printful store ID (17262304)
// - --product-id is the Printful *store product ID*
//   (visible under each product name in your Printful store).
// - PRINTFUL_TOKEN must be set in your .env

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_BASE = "https://api.printful.com";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Accept either --product-id or the old --template-id flag (for backwards compat)
  const storeProductId = Number(
    args["product-id"] || args["store-product-id"] || args["template-id"]
  );
  const storeId = args["store-id"] || "";
  const slug = String(args.slug || "");
  const name = String(args.name || "");
  const priceCents = Number(args.price || 4200);

  if (!storeProductId || !slug || !name || !storeId) {
    console.error(
      'Usage: node tools/add-product-from-template.js --store-id 17262304 --product-id 123456 --slug one-drop-midnight-grid --name "Midnight Grid" --price 4200'
    );
    process.exit(1);
  }

  const token = process.env.PRINTFUL_TOKEN;
  if (!token) {
    console.error("Missing PRINTFUL_TOKEN in .env");
    process.exit(1);
  }

  // 1) Look up store product details (variants, thumbnail, etc.)
  console.log("Fetching store product details for ID:", storeProductId);
  const storeProduct = await fetchStoreProduct(storeProductId, storeId, token);

  // Build S/M/L/XL → variant_id map from sync_variants[]
  const sizeVariantMap = buildSizeMapFromStoreProduct(storeProduct);
  console.log("Size map:", sizeVariantMap);

  if (!Object.keys(sizeVariantMap).length) {
    console.warn(
      "Warning: sizeVariantMap is empty – product may not have standard S/M/L/XL sizes."
    );
  }

  // 2) Pick a mockup / thumbnail URL for the product
  const mockupUrl = pickMockupUrl(storeProduct);
  if (!mockupUrl) {
    console.error(
      "Could not determine a mockup/thumbnail URL from the store product. " +
        "Check the API response structure or add --image-url support."
    );
    process.exit(1);
  }

  console.log("Mockup URL:", mockupUrl);

  // 3) Download mockup and save to public/images
  const imagesDir = path.join(process.cwd(), "public", "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const imageFilename = `${slug}.jpg`;
  const imagePath = path.join(imagesDir, imageFilename);
  const imagePublicPath = `/images/${imageFilename}`;

  console.log("Downloading mockup to:", imagePath);
  await downloadFile(mockupUrl, imagePath);

  // 4) Append product entry to src/data/products.json
  const productsJsonPath = path.join(process.cwd(), "src", "data", "products.json");
  const productObject = {
    id: slug,
    name,
    description: "",
    priceCents,
    currency: "usd",
    image: imagePublicPath,
    // Not strictly needed for Store API based flow, but useful metadata
    storeProductId,
    printFileUrl: "",
    sizeMap: sizeVariantMap, // e.g. { S: 12345, M: 12346, L: 12347, XL: 12348 }
  };

  console.log("Updating products.json with new product...");
  await appendProduct(productsJsonPath, productObject);

  console.log("Done. New product added as:", productObject);
}

// ---------- Helpers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      out[key] = value;
      i++;
    }
  }
  return out;
}

async function fetchStoreProduct(productId, storeId, token) {
  const res = await fetch(`${API_BASE}/store/products/${productId}?store_id=${storeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch store product: ${res.status} ${text}`);
  }

  const data = await res.json();
  // v1 Store API: { code, result: { sync_product, sync_variants, ... } }
  return data.result || data;
}

/**
 * Build a map like:
 *   { S: 12345, M: 12346, L: 12347, XL: 12348 }
 * from result.sync_variants[], using their variant_id and size/name.
 */
function buildSizeMapFromStoreProduct(storeProduct) {
  const sizeMap = {};

  const syncVariants = storeProduct.sync_variants || [];

  // Preferred sizes we care about for the storefront
  const preferredOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

  for (const variant of syncVariants) {
    const variantId = variant.variant_id; // catalog variant ID (used in orders)
    if (!variantId) continue;

    // Try to determine size label
    const sizeFromField =
      variant.size ||
      variant.product?.size ||
      extractSizeFromName(variant.name || "");

    const sizeLabel = sizeFromField && sizeFromField.toUpperCase();

    if (sizeLabel && preferredOrder.includes(sizeLabel)) {
      // Only keep the first mapping for a given size
      if (!sizeMap[sizeLabel]) {
        sizeMap[sizeLabel] = variantId;
      }
    }
  }

  // Optional: enforce subset S–XL only
  const filtered = {};
  for (const size of ["S", "M", "L", "XL"]) {
    if (sizeMap[size]) filtered[size] = sizeMap[size];
  }

  return filtered;
}

function extractSizeFromName(name) {
  // Try to find "XS", "S", "M", "L", "XL", "2XL", "3XL" in the variant name
  const match = name.match(/\b(3XL|2XL|XL|L|M|S|XS)\b/i);
  return match ? match[1] : null;
}

/**
 * Try to pick a usable mockup/thumbnail URL from the store product.
 * Priority:
 *   1) sync_product.thumbnail_url
 *   2) first sync_variant.files[].preview_url
 */
function pickMockupUrl(storeProduct) {
  if (storeProduct.sync_product?.thumbnail_url) {
    return storeProduct.sync_product.thumbnail_url;
  }

  const syncVariants = storeProduct.sync_variants || [];
  for (const variant of syncVariants) {
    const files = variant.files || [];
    for (const f of files) {
      if (f.preview_url) {
        return f.preview_url;
      }
    }
  }

  return null;
}

async function downloadFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to download file: ${res.status} ${await res.text()}`
    );
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

async function appendProduct(productsJsonPath, productObject) {
  let arr = [];
  if (fs.existsSync(productsJsonPath)) {
    const raw = fs.readFileSync(productsJsonPath, "utf8");
    try {
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch {
      arr = [];
    }
  }

  // avoid duplicates
  const existingIndex = arr.findIndex((p) => p.id === productObject.id);
  if (existingIndex >= 0) {
    arr[existingIndex] = productObject;
  } else {
    arr.push(productObject);
  }

  fs.writeFileSync(productsJsonPath, JSON.stringify(arr, null, 2), "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
})