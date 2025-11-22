// tools/auto-sync-products.js
//
// Automatically sync all Printful products that aren't in products.json yet
//
// Usage:
//   node tools/auto-sync-products.js

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_BASE = "https://api.printful.com";
const STORE_ID = "17262304";
const DEFAULT_PRICE = 2800; // $28.00

async function main() {
  const token = process.env.PRINTFUL_TOKEN;
  if (!token) {
    console.error("Missing PRINTFUL_TOKEN in .env");
    process.exit(1);
  }

  console.log("Fetching all Printful products...");
  const printfulProducts = await fetchAllStoreProducts(STORE_ID, token);
  console.log(`Found ${printfulProducts.length} products in Printful store`);

  // Load existing products
  const productsJsonPath = path.join(process.cwd(), "src", "data", "products.json");
  const existingProducts = loadExistingProducts(productsJsonPath);
  const existingIds = new Set(existingProducts.map(p => p.storeProductId));
  
  console.log(`Found ${existingProducts.length} products already in products.json`);

  // Find new products
  const newProducts = printfulProducts.filter(p => !existingIds.has(p.id));
  
  if (newProducts.length === 0) {
    console.log("✓ All products are already synced!");
    return;
  }

  console.log(`\nFound ${newProducts.length} new products to add:\n`);

  // Process each new product
  for (const product of newProducts) {
    console.log(`\n📦 Processing: ${product.name} (ID: ${product.id})`);
    
    try {
      await addProduct(product, token, productsJsonPath);
      console.log(`✓ Added successfully`);
    } catch (err) {
      console.error(`✗ Failed: ${err.message}`);
    }
  }

  console.log("\n✓ Sync complete!");
}

async function fetchAllStoreProducts(storeId, token) {
  const res = await fetch(`${API_BASE}/store/products?store_id=${storeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch products: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.result || [];
}

async function addProduct(product, token, productsJsonPath) {
  // Fetch full product details
  const storeProduct = await fetchStoreProduct(product.id, STORE_ID, token);

  // Generate slug from name
  const slug = generateSlug(product.name);
  
  // Generate creative name and description
  const { title, description } = generateNameAndDescription(product.name);

  // Build size map
  const sizeVariantMap = buildSizeMapFromStoreProduct(storeProduct);

  // Get mockup URL
  const mockupUrl = pickMockupUrl(storeProduct);
  if (!mockupUrl) {
    throw new Error("No mockup URL found");
  }

  // Download mockup
  const imagesDir = path.join(process.cwd(), "public", "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const imageFilename = `${slug}.jpg`;
  const imagePath = path.join(imagesDir, imageFilename);
  const imagePublicPath = `/images/${imageFilename}`;

  await downloadFile(mockupUrl, imagePath);

  // Create product object
  const productObject = {
    id: slug,
    title,
    description,
    price: DEFAULT_PRICE,
    image: imagePublicPath,
    printUrl: mockupUrl,
    storeProductId: product.id,
    sizeMap: sizeVariantMap,
  };

  // Append to products.json
  await appendProduct(productsJsonPath, productObject);
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateNameAndDescription(originalName) {
  // Simple title cleanup
  const title = originalName
    .replace(/\s*-\s*unisex.*$/i, "")
    .replace(/\s*shirt.*$/i, "")
    .trim();

  // Creative descriptions based on patterns
  const descriptions = [
    "Bold design. Limited edition print.",
    "Eye-catching graphics. Premium comfort.",
    "Unique artwork. One-time drop.",
    "Stand out from the crowd.",
    "Distinctive style. Rare piece.",
    "Statement piece. Exclusive design.",
    "Urban aesthetic. Limited availability.",
    "Creative expression. Wearable art.",
  ];

  const description = descriptions[Math.floor(Math.random() * descriptions.length)];

  return { title, description };
}

// --- Helper functions from original script ---

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

function buildSizeMapFromStoreProduct(storeProduct) {
  const sizeMap = {};
  const syncVariants = storeProduct.sync_variants || [];
  const preferredOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

  for (const variant of syncVariants) {
    const variantId = variant.variant_id;
    if (!variantId) continue;

    const sizeFromField =
      variant.size ||
      variant.product?.size ||
      extractSizeFromName(variant.name || "");

    const sizeLabel = sizeFromField && sizeFromField.toUpperCase();

    if (sizeLabel && preferredOrder.includes(sizeLabel)) {
      if (!sizeMap[sizeLabel]) {
        sizeMap[sizeLabel] = variantId;
      }
    }
  }

  const filtered = {};
  for (const size of ["S", "M", "L", "XL"]) {
    if (sizeMap[size]) filtered[size] = sizeMap[size];
  }

  return filtered;
}

function extractSizeFromName(name) {
  const match = name.match(/\b(3XL|2XL|XL|L|M|S|XS)\b/i);
  return match ? match[1] : null;
}

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
    throw new Error(`Failed to download file: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
}

function loadExistingProducts(productsJsonPath) {
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

async function appendProduct(productsJsonPath, productObject) {
  let arr = loadExistingProducts(productsJsonPath);

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
});