// tools/resync-mockups.js
//
// Re-download mockups with random colors/angles for existing products
//
// Usage:
//   node tools/resync-mockups.js                    (all products)
//   node tools/resync-mockups.js --slug heartskuildroid   (specific product)

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_BASE = "https://api.printful.com";
const STORE_ID = "17262304";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specificSlug = args["slug"];

  const token = process.env.PRINTFUL_TOKEN;
  if (!token) {
    console.error("Missing PRINTFUL_TOKEN in .env");
    process.exit(1);
  }

  const productsJsonPath = path.join(process.cwd(), "src", "data", "products.json");
  const products = loadProducts(productsJsonPath);

  const toUpdate = specificSlug 
    ? products.filter(p => p.id === specificSlug)
    : products;

  if (toUpdate.length === 0) {
    console.log(specificSlug ? `Product '${specificSlug}' not found` : "No products to update");
    return;
  }

  console.log(`Updating mockups for ${toUpdate.length} product(s)...\n`);

  for (const product of toUpdate) {
    if (!product.storeProductId) {
      console.log(`⊘ Skipping ${product.id} - no storeProductId`);
      continue;
    }

    try {
      console.log(`🔄 Updating: ${product.title || product.id}`);
      
      // Fetch fresh product data from Printful
      const storeProduct = await fetchStoreProduct(product.storeProductId, STORE_ID, token);
      
      // Pick new random mockup
      const mockupUrl = pickRandomMockupUrl(storeProduct);
      if (!mockupUrl) {
        console.log(`  ⊘ No mockup found`);
        continue;
      }

      // Download new mockup
      const imagesDir = path.join(process.cwd(), "public", "images");
      const imageFilename = `${product.id}.jpg`;
      const imagePath = path.join(imagesDir, imageFilename);
      
      await downloadFile(mockupUrl, imagePath);
      
      // Update printUrl in products.json
      product.printUrl = mockupUrl;
      
      console.log(`  ✓ Updated with new mockup`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  // Save updated products.json
  fs.writeFileSync(productsJsonPath, JSON.stringify(products, null, 2), "utf8");
  
  console.log("\n✓ Mockup refresh complete!");
}

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

function loadProducts(productsJsonPath) {
  if (!fs.existsSync(productsJsonPath)) {
    return [];
  }
  const raw = fs.readFileSync(productsJsonPath, "utf8");
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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
  return data.result || data;
}

function pickRandomMockupUrl(storeProduct) {
  const syncVariants = storeProduct.sync_variants || [];
  
  // Collect all available preview URLs from all variants (different colors/angles)
  const allPreviews = [];
  
  for (const variant of syncVariants) {
    const files = variant.files || [];
    for (const f of files) {
      if (f.preview_url) {
        allPreviews.push(f.preview_url);
      }
    }
  }

  // Pick a random one
  if (allPreviews.length > 0) {
    const randomIndex = Math.floor(Math.random() * allPreviews.length);
    return allPreviews[randomIndex];
  }

  // Fallback to thumbnail
  if (storeProduct.sync_product?.thumbnail_url) {
    return storeProduct.sync_product.thumbnail_url;
  }

  return null;
}

async function downloadFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});