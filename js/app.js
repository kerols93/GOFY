/**
 * GOFY Fashion Store - Core JavaScript Application
 * Production-ready Vanilla JS with Security (HTML Escaping),
 * Robust Egyptian Phone & Form Validation, Config-driven WhatsApp links,
 * Dynamic Highest Discount Computation, Proper Arabic Pluralization,
 * Conditional Fallback & Success Flows, and Granular Rating Display Controls.
 */

// ==========================================================================
// 1. Central Configuration
// ==========================================================================
const GOFY_CONFIG = {
  // Merchant details
  merchantPhone: "01006563866",
  merchantWhatsApp: "201006563866", // International Egyptian format for wa.me

  // Demo Mode toggle: set to false to remove sticky demo ribbon and set robots to index, follow
  DEMO_MODE: true,

  // Ratings display toggle: default false (keeps data, hides stars across all products)
  showRatings: false,

  // Google Sheets Integration (Phase 2 bridge)
  googleSheets: {
    scriptURL:  "https://script.google.com/macros/s/AKfycbxLDSsQ2u2HvKU6LW46Aj_9z-tnWLI9BFrZCbJ8Gzv92bsWTGwujQa7y7ONBCpEDl3l/exec",
    isEnabled: true  // Phase 2 Activated!
  }
};

// ==========================================================================
// 2. Security & Arabic Localization Helpers
// ==========================================================================
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert Arabic-Indic digits (٠-٩) to Western Arabic digits (0-9)
function normalizeArabicIndicDigits(str) {
  if (!str) return "";
  const arabicIndic = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(str).replace(/[٠-٩]/g, d => arabicIndic.indexOf(d));
}

// Egyptian Mobile Validation: Starts with 010, 011, 012, or 015 followed by 8 digits (11 total)
function isValidEgyptianMobile(phone) {
  const normalized = normalizeArabicIndicDigits(phone).trim();
  return /^01[0125][0-9]{8}$/.test(normalized);
}

// Arabic Pluralization for Item Quantities (1 قطعة، 2 قطعتين، 3-10 قطع)
function formatQuantityArabic(qty) {
  const n = parseInt(qty, 10) || 1;
  if (n === 1) return "1 قطعة";
  if (n === 2) return "2 قطعتين";
  if (n >= 3 && n <= 10) return `${n} قطع`;
  return `${n} قطعة`;
}

// ==========================================================================
// 3. Products Catalog Data (Loaded dynamically from Google Sheets)
// ==========================================================================
let PRODUCTS_DATA = [];

// App State
let currentCategory = "all";
let selectedProductForOrder = null;
let lastFocusedElement = null;

// ==========================================================================
// 4. App Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initMerchantPhoneAndJsonLd();
  initWhatsAppLinks();
  initRobotsMeta();
  initDiscountConfig();
  initDemoRibbon();
  loadProductsFromSheet();
  setupCategoryTabs();
  setupModalEvents();
  setupMobileNav();
  setupOrderForm();
});

// ==========================================================================
// 5. Dynamic Products Fetcher from Google Sheets
// ==========================================================================
async function loadProductsFromSheet() {
  const scriptURL = GOFY_CONFIG.googleSheets.scriptURL || (typeof localStorage !== "undefined" && localStorage.getItem("gofy_sheets_url"));

  if (!scriptURL) {
    renderProducts();
    initDiscountConfig();
    return;
  }

  const container = document.getElementById("productsGrid");
  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 14px; display: inline-block;"></i>
        <p style="font-weight: 700; color: var(--dark); font-size: 1.05rem;">جاري مزامنة المنتجات من شيت جوجل...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(scriptURL);
    const data = await res.json();
    if (data && Array.isArray(data.products) && data.products.length > 0) {
      PRODUCTS_DATA = data.products;
    } else {
      PRODUCTS_DATA = [];
    }
  } catch (err) {
    console.warn("Could not fetch products from Google Sheets:", err);
  } finally {
    renderProducts();
    initDiscountConfig();
  }
}

// ==========================================================================
// 5. Merchant Phone, JSON-LD Schema & Robots Setup
// ==========================================================================
function initMerchantPhoneAndJsonLd() {
  const phone = GOFY_CONFIG.merchantPhone;

  // 1. Footer WhatsApp line
  document.querySelectorAll("[data-wa-phone-text]").forEach(el => {
    el.textContent = `واتساب: ${phone}`;
  });

  // 2. Footer Phone line
  document.querySelectorAll("[data-merchant-phone-text]").forEach(el => {
    el.textContent = `الهاتف: ${phone}`;
  });

  // 3. Dynamic JSON-LD telephone update
  const jsonLdScript = document.getElementById("gofyJsonLd");
  if (jsonLdScript) {
    try {
      const schema = JSON.parse(jsonLdScript.textContent);
      schema.telephone = `+2${phone}`;
      jsonLdScript.textContent = JSON.stringify(schema, null, 2);
    } catch (e) {
      console.warn("Could not update JSON-LD telephone:", e);
    }
  }
}

function initRobotsMeta() {
  const robotsMeta = document.getElementById("metaRobots") || document.querySelector('meta[name="robots"]');
  if (robotsMeta) {
    robotsMeta.setAttribute("content", GOFY_CONFIG.DEMO_MODE ? "noindex, nofollow" : "index, follow");
  }

  // Ensure any meta keywords tag is removed
  const keywordsTag = document.querySelector('meta[name="keywords"]');
  if (keywordsTag) {
    keywordsTag.remove();
  }
}

function initWhatsAppLinks() {
  const defaultText = encodeURIComponent("مرحباً GOFY، أود الاستفسار عن الموديلات والأسعار المتاحة");
  const defaultUrl = `https://wa.me/${GOFY_CONFIG.merchantWhatsApp}?text=${defaultText}`;

  document.querySelectorAll("[data-wa-link]").forEach(link => {
    const customText = link.getAttribute("data-wa-text");
    if (customText) {
      link.href = `https://wa.me/${GOFY_CONFIG.merchantWhatsApp}?text=${encodeURIComponent(customText)}`;
    } else {
      link.href = defaultUrl;
    }
  });
}

// Compute the highest real discount percentage among PRODUCTS_DATA
function getHighestDiscountPercentage() {
  let maxDiscount = 0;
  PRODUCTS_DATA.forEach(p => {
    if (p.oldPrice && p.oldPrice > p.price) {
      const discount = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
      if (discount > maxDiscount) maxDiscount = discount;
    }
  });
  return maxDiscount || 25;
}

function initDiscountConfig() {
  const maxDiscount = getHighestDiscountPercentage();
  
  const topBarEl = document.querySelector("[data-cfg-discount-top]");
  if (topBarEl) {
    topBarEl.textContent = `✨ خصومات خاصة بالموسم الجديد حتى ${maxDiscount}%`;
  }

  const heroBadgeVal = document.querySelector("[data-cfg-discount-val]");
  if (heroBadgeVal) {
    heroBadgeVal.textContent = `${maxDiscount}%`;
  }

  const promoBadgeEl = document.querySelector("[data-cfg-discount-promo]");
  if (promoBadgeEl) {
    promoBadgeEl.textContent = `${maxDiscount}%`;
  }
}

function initDemoRibbon() {
  const existingRibbon = document.getElementById("demoModeRibbon");
  if (GOFY_CONFIG.DEMO_MODE) {
    if (!existingRibbon) {
      const ribbon = document.createElement("div");
      ribbon.id = "demoModeRibbon";
      ribbon.className = "demo-ribbon";
      ribbon.setAttribute("aria-hidden", "true");
      ribbon.textContent = "نسخة تجريبية";
      document.body.appendChild(ribbon);
    }
  } else if (existingRibbon) {
    existingRibbon.remove();
  }
}

// ==========================================================================
// 6. Dynamic Rating Stars Helper (Controlled by showRatings)
// ==========================================================================
function renderRatingStars(rating) {
  // Only render if showRatings is true in config AND rating exists
  if (!GOFY_CONFIG.showRatings || typeof rating !== "number" || rating <= 0) {
    return "";
  }

  const fullStars = Math.floor(rating);
  const remainder = rating - fullStars;
  const hasHalf = remainder >= 0.3 && remainder <= 0.8;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalf ? 1 : 0));

  let stars = "";
  for (let i = 0; i < fullStars; i++) {
    stars += `<i class="fas fa-star" aria-hidden="true"></i>`;
  }
  if (hasHalf) {
    stars += `<i class="fas fa-star-half-alt" aria-hidden="true"></i>`;
  }
  for (let i = 0; i < emptyStars; i++) {
    stars += `<i class="far fa-star" aria-hidden="true"></i>`;
  }

  return `
    <div class="product-rating" aria-label="التقييم: ${rating} من 5">
      ${stars}
      <span>(${rating})</span>
    </div>
  `;
}

// ==========================================================================
// 7. Products Rendering & Filtering (With Full HTML Escaping)
// ==========================================================================
function renderProducts() {
  const container = document.getElementById("productsGrid");
  if (!container) return;

  const filtered = currentCategory === "all" 
    ? PRODUCTS_DATA 
    : PRODUCTS_DATA.filter(p => p.category === currentCategory);

  if (filtered.length === 0) {
    if (PRODUCTS_DATA.length === 0) {
      container.innerHTML = `
        <div class="empty-products-state">
          <i class="fas fa-box-open" style="font-size: 3.5rem; color: var(--primary); margin-bottom: 16px; display: inline-block;"></i>
          <h3>جاهز لإضافة تشكيلة منتجاتك! 🛍️</h3>
          <p>تم إفراغ المنتجات التجريبية لتتمكن من إضافة كولكشن ملابسك الخاص من شيت جوجل. اكتب منتجاتك في صفحة "المنتجات" لتظهر هنا مباشرة لعملائك.</p>
          <a href="google_sheets/test_connection.html" target="_blank" class="btn-primary" style="margin-top: 10px; display: inline-flex; text-decoration: none;">
            <i class="fas fa-table"></i> فتح صفحة فحص وربط شيت جوجل
          </a>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px;">
          <i class="fas fa-box-open" style="font-size: 3rem; color: #BDC3C7; margin-bottom: 12px; display: inline-block;"></i>
          <p style="font-size: 1.1rem; color: #7F8C8D;">لا توجد منتجات حالياً في هذا القسم.</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = filtered.map(product => {
    // Dynamic discount computation per product
    let discountBadgeHTML = "";
    if (product.oldPrice && product.oldPrice > product.price) {
      const discountPercent = Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
      discountBadgeHTML = `<span class="badge-discount">خصم ${discountPercent}%</span>`;
    }

    // Escaped variables
    const safeId = Number(product.id);
    const safeName = escapeHTML(product.name);
    const safeCat = escapeHTML(product.categoryLabel);
    const safeImg = escapeHTML(product.image);
    const safePrice = Number(product.price);
    const safeOldPrice = Number(product.oldPrice || 0);
    const ratingHTML = renderRatingStars(product.rating);

    // Sizes display
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    const displayedSizes = sizes.slice(0, 3).map(s => `<span class="size-chip">${escapeHTML(s)}</span>`).join('');
    const extraSizesBadge = sizes.length > 3 ? `<span class="size-chip">+${sizes.length - 3}</span>` : '';

    return `
      <div class="product-card" data-id="${safeId}">
        <div class="product-image-box">
          ${discountBadgeHTML}
          <span class="badge-cat">${safeCat}</span>
          <img src="${safeImg}" alt="${safeName}" loading="lazy" />
          <button class="quick-view-btn" onclick="openOrderModal(${safeId}, this)" aria-label="معاينة وطلب ${safeName}">
            <i class="fas fa-eye"></i> معاينة وطلب سريع
          </button>
        </div>

        <div class="product-info">
          <span class="product-category-sub">${safeCat}</span>
          <h4 class="product-title" title="${safeName}">${safeName}</h4>
          
          ${ratingHTML}

          <div class="product-sizes" aria-label="المقاسات المتاحة">
            <span style="font-size: 0.75rem; color: #7F8C8D; margin-left: 4px;">المقاسات:</span>
            ${displayedSizes}
            ${extraSizesBadge}
          </div>

          <div class="product-price-row">
            <div class="price-box">
              <span class="current-price">${safePrice} ج.م</span>
              ${safeOldPrice > safePrice ? `<span class="old-price">${safeOldPrice} ج.م</span>` : ''}
            </div>
            <button class="btn-order-now" onclick="openOrderModal(${safeId}, this)" aria-label="طلب ${safeName} الآن">
              <i class="fas fa-shopping-bag"></i> اطلبي الآن
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setupCategoryTabs() {
  const tabs = document.querySelectorAll(".cat-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      currentCategory = tab.getAttribute("data-category");
      renderProducts();
    });
  });
}

// ==========================================================================
// 8. Order Modal & Live Total Calculation (Proper Arabic Plurals)
// ==========================================================================
function updateLiveOrderTotal() {
  if (!selectedProductForOrder) return;
  const qtyInput = document.getElementById("orderQty");
  const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1, 10) || 1);
  const total = Number(selectedProductForOrder.price) * qty;

  const totalEl = document.getElementById("modalLiveTotal");
  if (totalEl) {
    totalEl.textContent = `${total} ج.م (${formatQuantityArabic(qty)})`;
  }
}

function openOrderModal(productId, triggerBtn) {
  const product = PRODUCTS_DATA.find(p => p.id === productId);
  if (!product) return;

  selectedProductForOrder = product;
  lastFocusedElement = triggerBtn || document.activeElement;

  // Fill in modal details
  const imgEl = document.getElementById("modalProdImg");
  imgEl.src = product.image;
  imgEl.alt = product.name;

  document.getElementById("modalProdTitle").textContent = product.name;
  document.getElementById("modalProdPrice").textContent = `${product.price} ج.م`;
  document.getElementById("modalProdCat").textContent = product.categoryLabel;

  // Populate size options with escaping
  const sizeSelect = document.getElementById("orderSize");
  sizeSelect.innerHTML = product.sizes.map(s => 
    `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`
  ).join('');

  // Populate color options with escaping
  const colorSelect = document.getElementById("orderColor");
  colorSelect.innerHTML = product.colors.map(c => 
    `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
  ).join('');

  // Reset quantity and calculate initial live total
  const qtyInput = document.getElementById("orderQty");
  if (qtyInput) qtyInput.value = 1;
  updateLiveOrderTotal();

  // Reset views and errors
  document.getElementById("orderForm").style.display = "block";
  document.getElementById("orderSuccessView").style.display = "none";
  document.getElementById("orderFallbackView").style.display = "none";
  clearAllValidationErrors();
  document.getElementById("orderForm").reset();
  if (qtyInput) qtyInput.value = 1;
  updateLiveOrderTotal();

  // Lock body scroll and open modal
  const modal = document.getElementById("orderModal");
  modal.classList.add("active");
  document.body.classList.add("modal-open");

  // Focus the first form input for accessibility
  setTimeout(() => {
    const firstInput = document.getElementById("customerName");
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) modal.classList.remove("active");
  document.body.classList.remove("modal-open");
  selectedProductForOrder = null;

  // Return focus to the trigger button for accessibility
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function setupModalEvents() {
  const modal = document.getElementById("orderModal");
  const closeBtn = document.getElementById("modalCloseBtn");
  const qtyInput = document.getElementById("orderQty");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeOrderModal);
  }

  // Click outside modal card to close
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeOrderModal();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modal && modal.classList.contains("active")) {
        closeOrderModal();
      }
    }
  });

  // Live total calculation on quantity change
  if (qtyInput) {
    qtyInput.addEventListener("input", updateLiveOrderTotal);
    qtyInput.addEventListener("change", updateLiveOrderTotal);
  }
}

// ==========================================================================
// 9. Form Validation & Submission
// ==========================================================================
function clearAllValidationErrors() {
  document.querySelectorAll(".field-error").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".form-control").forEach(el => el.classList.remove("has-error"));
}

function showFieldError(inputId, errorId, message) {
  const inputEl = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (inputEl) inputEl.classList.add("has-error");
  if (errorEl) {
    if (message) errorEl.textContent = message;
    errorEl.classList.add("active");
  }
}

function clearFieldError(inputId, errorId) {
  const inputEl = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (inputEl) inputEl.classList.remove("has-error");
  if (errorEl) errorEl.classList.remove("active");
}

function setupOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const nameInput = document.getElementById("customerName");
  const phoneInput = document.getElementById("customerPhone");
  const addressInput = document.getElementById("customerAddress");

  // Real-time error clearing as user types
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      if (nameInput.value.trim().length >= 3) {
        clearFieldError("customerName", "nameError");
      }
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      if (isValidEgyptianMobile(phoneInput.value)) {
        clearFieldError("customerPhone", "phoneError");
      }
    });
  }

  if (addressInput) {
    addressInput.addEventListener("input", () => {
      if (addressInput.value.trim().length >= 8) {
        clearFieldError("customerAddress", "addressError");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllValidationErrors();

    // 1. Validate Form Fields
    let hasError = false;
    let firstErrorField = null;

    const rawName = nameInput.value.trim();
    if (rawName.length < 3) {
      showFieldError("customerName", "nameError", "يرجى كتابة الاسم (3 أحرف على الأقل)");
      hasError = true;
      if (!firstErrorField) firstErrorField = nameInput;
    }

    const rawPhone = phoneInput.value;
    const normalizedPhone = normalizeArabicIndicDigits(rawPhone).trim();
    if (!isValidEgyptianMobile(normalizedPhone)) {
      showFieldError("customerPhone", "phoneError", "يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)");
      hasError = true;
      if (!firstErrorField) firstErrorField = phoneInput;
    }

    const rawAddress = addressInput.value.trim();
    if (rawAddress.length < 8) {
      showFieldError("customerAddress", "addressError", "يرجى إدخال العنوان بالتفصيل (8 أحرف على الأقل)");
      hasError = true;
      if (!firstErrorField) firstErrorField = addressInput;
    }

    if (hasError) {
      if (firstErrorField && typeof firstErrorField.focus === "function") {
        firstErrorField.focus();
      }
      return; // Block submit
    }

    // 2. Gather Validated Payload
    const qty = Math.max(1, parseInt(document.getElementById("orderQty").value, 10) || 1);
    const unitPrice = selectedProductForOrder ? Number(selectedProductForOrder.price) : 0;
    const totalPrice = unitPrice * qty;

    const orderData = {
      orderId: "GOFY-" + Math.floor(100000 + Math.random() * 900000),
      timestamp: new Date().toLocaleString("ar-EG"),
      productName: selectedProductForOrder ? selectedProductForOrder.name : "منتج من GOFY",
      category: selectedProductForOrder ? selectedProductForOrder.categoryLabel : "",
      price: unitPrice,
      size: document.getElementById("orderSize").value,
      color: document.getElementById("orderColor").value,
      quantity: qty,
      totalPrice: totalPrice,
      customerName: rawName,
      customerPhone: normalizedPhone,
      customerGov: document.getElementById("customerGov").value,
      customerAddress: rawAddress,
      customerNotes: document.getElementById("customerNotes").value.trim()
    };

    const submitBtn = form.querySelector(".btn-submit-order");
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري تأكيد الطلب...`;
    submitBtn.disabled = true;

    try {
      // 3. Google Sheets Submission Flow
      const activeScriptURL = GOFY_CONFIG.googleSheets.scriptURL || (typeof localStorage !== "undefined" && localStorage.getItem("gofy_sheets_url"));

      if (GOFY_CONFIG.googleSheets.isEnabled && activeScriptURL) {
        await fetch(activeScriptURL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData)
        });
        
        saveLocalOrder(orderData);
        // Real success: Google Sheets was active and received the request
        showOrderSuccess(orderData);
      } else {
        // Disabled or Demo Mode: Simulate short processing delay, then show WhatsApp Fallback
        await new Promise(r => setTimeout(r, 600));
        saveLocalOrder(orderData);

        // Demo Mode / Sheets Disabled: show fallback with demo notice
        showOrderFallback(orderData, "demo");
      }

    } catch (err) {
      console.error("Order submission failure:", err);
      // On Google Sheets failure: show WhatsApp Fallback with failure notice
      showOrderFallback(orderData, "sheets_failure");
    } finally {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  });
}

function saveLocalOrder(orderData) {
  try {
    const existing = JSON.parse(localStorage.getItem("gofy_orders") || "[]");
    existing.unshift(orderData);
    localStorage.setItem("gofy_orders", JSON.stringify(existing));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

// ==========================================================================
// 10. Real Success Screen (Only on True Google Sheets Success)
// ==========================================================================
function showOrderSuccess(orderData) {
  const form = document.getElementById("orderForm");
  const successView = document.getElementById("orderSuccessView");
  const fallbackView = document.getElementById("orderFallbackView");

  form.style.display = "none";
  if (fallbackView) fallbackView.style.display = "none";
  successView.style.display = "block";

  document.getElementById("successOrderId").textContent = orderData.orderId;
  document.getElementById("successCustomer").textContent = `${orderData.customerName} (${orderData.customerPhone})`;

  // Configure optional WhatsApp copy
  const waBtn = document.getElementById("btnSendWAConfirmation");
  if (waBtn) {
    const waText = buildWhatsAppOrderMessage(orderData);
    waBtn.href = `https://wa.me/${GOFY_CONFIG.merchantWhatsApp}?text=${encodeURIComponent(waText)}`;
  }
}

// ==========================================================================
// 11. WhatsApp Fallback Screen (On Failure or When Sheets Disabled/Demo)
// ==========================================================================
function showOrderFallback(orderData, triggerReason = "demo") {
  const form = document.getElementById("orderForm");
  const successView = document.getElementById("orderSuccessView");
  const fallbackView = document.getElementById("orderFallbackView");

  form.style.display = "none";
  if (successView) successView.style.display = "none";
  fallbackView.style.display = "block";

  // Dynamic message based on trigger reason
  const noticeTextEl = document.getElementById("fallbackNoticeText");
  const titleEl = document.getElementById("fallbackTitle");
  if (noticeTextEl) {
    if (triggerReason === "sheets_failure") {
      noticeTextEl.textContent = "حصلت مشكلة بسيطة في إرسال الطلب، أكمل طلبك بنقرة واحدة عبر واتساب:";
      if (titleEl) titleEl.textContent = "تأكيد الطلب السريع عبر واتساب";
    } else {
      noticeTextEl.textContent = "نظراً لأن المتجر في الوضع التجريبي، يمكنك إتمام طلبك مباشرة مع خدمة عملاء GOFY عبر واتساب بنقرة واحدة لضمان سرعة التجهيز والشحن:";
      if (titleEl) titleEl.textContent = "تأكيد الطلب المباشر عبر واتساب";
    }
  }

  // Build summary card with proper Arabic plurals
  const summaryContainer = document.getElementById("fallbackOrderSummary");
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="fallback-summary-item">
        <span class="label">رقم الطلب:</span>
        <span class="val">${escapeHTML(orderData.orderId)}</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">المنتج:</span>
        <span class="val">${escapeHTML(orderData.productName)}</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">المقاس واللون:</span>
        <span class="val">${escapeHTML(orderData.size)} - ${escapeHTML(orderData.color)}</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">الكمية:</span>
        <span class="val">${formatQuantityArabic(orderData.quantity)}</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">الاسم ورقم الهاتف:</span>
        <span class="val">${escapeHTML(orderData.customerName)} (${escapeHTML(orderData.customerPhone)})</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">العنوان:</span>
        <span class="val">${escapeHTML(orderData.customerGov)} - ${escapeHTML(orderData.customerAddress)}</span>
      </div>
      <div class="fallback-summary-item">
        <span class="label">إجمالي الحساب:</span>
        <span class="val" style="color: var(--primary); font-size: 1.05rem;">${Number(orderData.totalPrice)} ج.م</span>
      </div>
    `;
  }

  // Configure direct WhatsApp button
  const waFallbackBtn = document.getElementById("btnFallbackWhatsApp");
  if (waFallbackBtn) {
    const waText = buildWhatsAppOrderMessage(orderData);
    waFallbackBtn.href = `https://wa.me/${GOFY_CONFIG.merchantWhatsApp}?text=${encodeURIComponent(waText)}`;
  }
}

function buildWhatsAppOrderMessage(orderData) {
  return (
    `مرحباً GOFY، أود تأكيد طلبي (${orderData.orderId}):\n\n` +
    `👗 المنتج: ${orderData.productName}\n` +
    `📏 المقاس: ${orderData.size}\n` +
    `🎨 اللون: ${orderData.color}\n` +
    `📦 الكمية: ${formatQuantityArabic(orderData.quantity)}\n` +
    `💰 الإجمالي: ${orderData.totalPrice} ج.م\n\n` +
    `👤 بيانات العميل:\n` +
    `الاسم: ${orderData.customerName}\n` +
    `الموبايل: ${orderData.customerPhone}\n` +
    `العنوان: ${orderData.customerGov} - ${orderData.customerAddress}\n` +
    (orderData.customerNotes ? `📝 ملاحظات: ${orderData.customerNotes}\n` : "") +
    `\nيرجى تأكيد موعد الشحن والتسليم.`
  );
}

// ==========================================================================
// 12. Mobile Navigation Toggle
// ==========================================================================
function setupMobileNav() {
  const toggleBtn = document.getElementById("menuToggleBtn");
  const navMenu = document.getElementById("navMenu");

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close menu when clicking link
    navMenu.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("open");
        toggleBtn.setAttribute("aria-expanded", "false");
      });
    });
  }
}
