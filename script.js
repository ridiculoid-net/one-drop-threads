// script.js

let products = [];

const themeToggle = document.getElementById("themeToggle");
const rootHtml = document.documentElement;
const yearEl = document.getElementById("year");
const grid = document.getElementById("productGrid");

// Stats
const statLiveCountEl = document.getElementById("statLiveCount");
const statTotalCountEl = document.getElementById("statTotalCount");

// Modal elements
const modal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const sizeSelect = document.getElementById("sizeSelect");
const buyButton = document.getElementById("buyButton");
const modalStatus = document.getElementById("modalStatus");

let currentProduct = null;

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initYear();
  initThemeToggle();
  loadProductsAndBuildGrid();
  initModalHandlers();
});

// ---------- THEME ----------

function initTheme() {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme) {
    rootHtml.setAttribute("data-theme", storedTheme);
    themeToggle.textContent = storedTheme === "dark" ? "☾" : "☼";
  } else {
    rootHtml.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☾";
  }
}

function initThemeToggle() {
  themeToggle.addEventListener("click", () => {
    const current = rootHtml.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    rootHtml.setAttribute("data-theme", next);
    themeToggle.textContent = next === "dark" ? "☾" : "☼";
    localStorage.setItem("theme", next);
  });
}

function initYear() {
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// ---------- PRODUCTS / GRID ----------

async function loadProductsAndBuildGrid() {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) {
      throw new Error("Failed to load products");
    }
    products = await res.json();
    buildProductGrid();
    updateHeroStats();
  } catch (err) {
    console.error(err);
    grid.innerHTML =
      '<p style="color: var(--muted); text-align:center;">Unable to load drops right now.</p>';
    if (statLiveCountEl) statLiveCountEl.textContent = "–";
    if (statTotalCountEl) statTotalCountEl.textContent = "–";
  }
}

function buildProductGrid() {
  grid.innerHTML = "";

  products.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = p.id;

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${p.image}" alt="${p.name}" />
      </div>
      <div class="product-meta">
        <h3>${p.name}</h3>
        <span>${p.priceFormatted}</span>
      </div>
      <div class="product-footer">
        <span class="badge badge-rare">Single edition</span>
        ${
          p.sold
            ? '<span class="badge badge-sold">Sold</span>'
            : '<span class="badge">Available</span>'
        }
      </div>
    `;

    if (!p.sold) {
      card.addEventListener("click", () => openProductModal(p.id));
    } else {
      card.style.opacity = 0.6;
      card.style.cursor = "default";
    }

    grid.appendChild(card);
  });
}

function updateHeroStats() {
  if (!Array.isArray(products)) return;
  const total = products.length;
  const live = products.filter((p) => !p.sold).length;

  if (statTotalCountEl) {
    statTotalCountEl.textContent = total === 0 ? "0" : String(total);
  }
  if (statLiveCountEl) {
    statLiveCountEl.textContent = live === 0 ? "0" : String(live);
  }
}

// ---------- MODAL / CHECKOUT ----------

function initModalHandlers() {
  modalClose.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      closeModal();
    }
  });

  buyButton.addEventListener("click", handleBuyClick);
}

function openProductModal(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p || p.sold) return;

  currentProduct = p;

  modalImage.src = p.image;
  modalImage.alt = p.name;
  modalTitle.textContent = p.name;
  modalDescription.textContent = p.description || "";
  modalPrice.textContent = p.priceFormatted;
  modalStatus.textContent = "";

  sizeSelect.innerHTML = "";
  (p.sizes || []).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sizeSelect.appendChild(opt);
  });

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  currentProduct = null;
}

async function handleBuyClick() {
  if (!currentProduct) return;

  const size = sizeSelect.value;
  if (!size) {
    modalStatus.textContent = "Please pick a size.";
    return;
  }

  modalStatus.textContent = "Creating checkout…";

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: currentProduct.id,
        size,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("Checkout error:", errBody);
      modalStatus.textContent =
        errBody?.error || "Failed to create checkout session.";
      return;
    }

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      modalStatus.textContent = "No checkout URL returned from server.";
    }
  } catch (err) {
    console.error(err);
    modalStatus.textContent =
      "Something went wrong starting checkout. Please try again.";
  }
}
