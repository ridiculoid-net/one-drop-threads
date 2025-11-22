// tools/remove-background.js
//
// Remove background from design images and upload to Printful
//
// Usage:
//   1. Get API key from https://remove.bg
//   2. Add REMOVEBG_API_KEY to .env
//   3. node tools/remove-background.js --image path/to/image.png --product-id 403839395

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const PRINTFUL_API_BASE = "https://api.printful.com";
const REMOVEBG_API_BASE = "https://api.remove.bg/v1.0";
const STORE_ID = "17262304";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const imagePath = args["image"];
  const productId = args["product-id"];

  if (!imagePath || !productId) {
    console.error('Usage: node tools/remove-background.js --image path/to/image.png --product-id 403839395');
    console.error('\nGet Remove.bg API key at: https://remove.bg/users/sign_up');
    process.exit(1);
  }

  const removeBgKey = process.env.REMOVEBG_API_KEY;
  const printfulToken = process.env.PRINTFUL_TOKEN;

  if (!removeBgKey) {
    console.error("Missing REMOVEBG_API_KEY in .env");
    console.error("Get one at: https://remove.bg/users/sign_up");
    process.exit(1);
  }

  if (!printfulToken) {
    console.error("Missing PRINTFUL_TOKEN in .env");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  console.log("\n🖼️  Processing image:", imagePath);

  // 1. Remove background
  console.log("🔄 Removing background...");
  const imageBuffer = fs.readFileSync(imagePath);
  const transparentImage = await removeBackground(imageBuffer, removeBgKey);

  // 2. Save transparent version
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `transparent-${Date.now()}.png`);
  fs.writeFileSync(outputPath, transparentImage);
  console.log("✓ Saved transparent image:", outputPath);

  // 3. Upload to Printful
  console.log("\n📤 Uploading to Printful...");
  const fileUrl = await uploadToPrintful(transparentImage, printfulToken);
  console.log("✓ Uploaded to Printful:", fileUrl);

  // 4. Update product design
  console.log("\n🔄 Updating product design...");
  await updateProductDesign(productId, fileUrl, printfulToken);
  console.log("✓ Product design updated!");

  console.log("\n✅ Done! Your product now has a transparent design.");
  console.log("   Run resync-mockups.js to update the mockup in your store.");
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

async function removeBackground(imageBuffer, apiKey) {
  const formData = new FormData();
  const blob = new Blob([imageBuffer]);
  formData.append('image_file', blob, 'image.png');
  formData.append('size', 'auto');

  const res = await fetch(`${REMOVEBG_API_BASE}/removebg`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Remove.bg failed: ${res.status} ${text}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function uploadToPrintful(imageBuffer, token) {
  // Printful expects base64
  const base64 = imageBuffer.toString('base64');

  const res = await fetch(`${PRINTFUL_API_BASE}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'default',
      filename: `design-${Date.now()}.png`,
      url: `data:image/png;base64,${base64}`
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful upload failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.result.url;
}

async function updateProductDesign(productId, fileUrl, token) {
  // Get current product to preserve settings
  const getRes = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}?store_id=${STORE_ID}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`Failed to get product: ${getRes.status} ${text}`);
  }

  const productData = await getRes.json();
  const product = productData.result;

  // Update all variants with new design
  const updatedVariants = product.sync_variants.map(variant => ({
    id: variant.id,
    files: [
      {
        type: 'default',
        url: fileUrl,
        position: 'front'
      }
    ]
  }));

  // Update product
  const updateRes = await fetch(`${PRINTFUL_API_BASE}/store/products/${productId}?store_id=${STORE_ID}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sync_variants: updatedVariants
    })
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Failed to update product: ${updateRes.status} ${text}`);
  }

  return await updateRes.json();
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});