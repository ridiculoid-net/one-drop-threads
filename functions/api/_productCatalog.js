// functions/api/_productCatalog.js

export const productCatalog = {
  "design-001": {
    id: "design-001",
    name: "Monochrome Orbit",
    description: "Single-edition tee with abstract orbital lines.",
    priceCents: 4200,
    currency: "usd",
    image: "/images/design-001.jpg",
    printFileUrl: "https://your-cdn-or-printful-file-url/design-001.png",
    sizeMap: {
      S: { variantId: 123456789 },
      M: { variantId: 123456790 },
      L: { variantId: 123456791 },
      XL: { variantId: 123456792 },
    },
  },
  "design-002": {
    id: "design-002",
    name: "Static Bloom",
    description: "Noise-textured floral glitch on a clean single-edition tee.",
    priceCents: 4500,
    currency: "usd",
    image: "/images/design-002.jpg",
    printFileUrl: "https://your-cdn-or-printful-file-url/design-002.png",
    sizeMap: {
      M: { variantId: 987654321 },
      L: { variantId: 987654322 },
    },
  },
  // Add more designs...
};
