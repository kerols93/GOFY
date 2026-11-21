/**
 * ============================================================================
 * GOFY Fashion Store - Google Apps Script Backend (النسخة الكاملة)
 * إدارة المنتجات والطلبات بالكامل من شيت جوجل
 * ============================================================================
 * 
 * الميزات:
 * 1. قراءة المنتجات مباشرة من شيت "المنتجات" وعرضها على موقع GOFY.
 * 2. استقبال طلبات العملاء من الموقع وحفظها فوراً في شيت "الطلبات".
 * 3. إنشاء الصفحتين (المنتجات + الطلبات) وتنسيقهما تلقائياً بألوان براند GOFY!
 * 
 * طريقة التشغيل:
 * 1. افتح شيت جوجل واضغط: التوسيعات (Extensions) -> Apps Script
 * 2. الصق هذا الكود بالكامل واضغط حفظ 💾
 * 3. اضغط: نشر (Deploy) -> توزيع جديد (New deployment) -> تطبيق ويب (Web app)
 * 4. اجعل "من يملك حق الوصول": أي شخص (Anyone) واضغط نشر
 * 5. انسخ الرابط الناتج وضعه في المتجر!
 * ============================================================================
 */

// 1. استقبال الطلبات من المتجر وتسجيلها في شيت "الطلبات"
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    ensureSheetsSetup();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("الطلبات");
    
    var order = JSON.parse(e.postData.contents);

    var rowData = [
      order.timestamp || new Date().toLocaleString("ar-EG"),
      order.orderId || "GOFY-" + Math.floor(Math.random() * 900000 + 100000),
      order.customerName || "",
      "'" + (order.customerPhone || ""), // علامة ' لحفظ الرقم كنص وعدم مسح الصفر الأول
      order.customerGov || "",
      order.customerAddress || "",
      order.productName || "",
      order.category || "",
      order.size || "",
      order.color || "",
      Number(order.quantity) || 1,
      Number(order.price) || 0,
      Number(order.totalPrice) || 0,
      order.customerNotes || "",
      "جديد" // حالة الطلب
    ];

    sheet.appendRow(rowData);

    var lastRow = sheet.getLastRow();
    var range = sheet.getRange(lastRow, 1, 1, rowData.length);
    range.setHorizontalAlignment("center");
    range.setVerticalAlignment("middle");
    range.setFontFamily("Cairo");

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      orderId: order.orderId,
      message: "تم حفظ الطلب في شيت جوجل بنجاح!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// 2. إرسال المنتجات من شيت "المنتجات" إلى الموقع
function doGet(e) {
  try {
    ensureSheetsSetup();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("المنتجات");

    var data = sheet.getDataRange().getValues();
    var products = [];

    // تخطي صف الهيدر (الصف الأول)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0];
      var name = row[1];
      var catLabel = row[2];
      var price = Number(row[3]);
      var oldPrice = Number(row[4]) || 0;
      var image = row[5];
      var sizesRaw = row[6] ? String(row[6]) : "";
      var colorsRaw = row[7] ? String(row[7]) : "";
      var description = row[8] || "";
      var status = row[9] ? String(row[9]).trim() : "نشط";

      // تجاهل الصفوف الفارغة أو المنتجات غير النشطة
      if (!name || status === "غير نشط") continue;

      // تحديد كود القسم البرمجي المناسب للموقع
      var catKey = "kids-girls";
      if (catLabel.indexOf("أولاد") !== -1) catKey = "kids-boys";
      else if (catLabel.indexOf("بيبي") !== -1 || catLabel.indexOf("مواليد") !== -1) catKey = "kids-baby";
      else if (catLabel.indexOf("كاجوال") !== -1 || catLabel.indexOf("خروج") !== -1) catKey = "women-casual";
      else if (catLabel.indexOf("بيتي") !== -1 || catLabel.indexOf("بيجامات") !== -1) catKey = "women-home";

      // تحويل المقاسات والألوان لمصفوفة
      var sizes = sizesRaw.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
      var colors = colorsRaw.split(",").map(function(c) { return c.trim(); }).filter(Boolean);

      products.push({
        id: id || i,
        name: name,
        category: catKey,
        categoryLabel: catLabel,
        price: price,
        oldPrice: oldPrice,
        image: image || "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=700&q=80",
        sizes: sizes.length ? sizes : ["مقاس موحد"],
        colors: colors.length ? colors : ["متعدد الألوان"],
        description: description
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      store: "GOFY Fashion Store",
      count: products.length,
      products: products
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 3. دالة التهيئة التلقائية للشيت (تنشئ الصفحتين وتنسقهما بألوان GOFY)
function ensureSheetsSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // أولاً: صفحة المنتجات
  var prodSheet = ss.getSheetByName("المنتجات");
  if (!prodSheet) {
    prodSheet = ss.insertSheet("المنتجات", 0);
  }
  if (prodSheet.getLastRow() === 0) {
    var prodHeaders = [
      "كود المنتج",
      "اسم المنتج",
      "القسم",
      "السعر (ج.م)",
      "السعر قبل الخصم (ج.م)",
      "رابط الصورة",
      "المقاسات (مفصولة بفاصلة)",
      "الألوان (مفصولة بفاصلة)",
      "الوصف",
      "الحالة (نشط / غير نشط)"
    ];
    prodSheet.appendRow(prodHeaders);

    // تنسيق الهيدر
    formatHeaderRow(prodSheet, prodHeaders.length, "#E84393");
    prodSheet.setRightToLeft(true);
    prodSheet.setFrozenRows(1);

    // إضافة صف تجريبي توضيحي
    prodSheet.appendRow([
      1,
      "فستان أطفال صيفي بناتي كشكش",
      "أطفال - بنات",
      320,
      420,
      "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=700&q=80",
      "1-2 سنة, 2-3 سنوات, 4-5 سنوات",
      "وردي ناعم, أصفر باستيل, أبيض",
      "خامة قطنية 100% ناعمة ومريحة للبنات",
      "نشط"
    ]);
  }

  // ثانياً: صفحة الطلبات
  var orderSheet = ss.getSheetByName("الطلبات");
  if (!orderSheet) {
    orderSheet = ss.insertSheet("الطلبات", 1);
  }
  if (orderSheet.getLastRow() === 0) {
    var orderHeaders = [
      "تاريخ ووقت الطلب",
      "رقم الطلب",
      "اسم العميل",
      "رقم الهاتف / واتساب",
      "المحافظة",
      "العنوان بالتفصيل",
      "اسم المنتج",
      "القسم",
      "المقاس",
      "اللون",
      "الكمية",
      "سعر القطعة (ج.م)",
      "إجمالي الحساب (ج.م)",
      "ملاحظات العميل",
      "حالة الطلب"
    ];
    orderSheet.appendRow(orderHeaders);

    formatHeaderRow(orderSheet, orderHeaders.length, "#00CEC9");
    orderSheet.setRightToLeft(true);
    orderSheet.setFrozenRows(1);
  }

  // حذف الورقة الافتراضية "ورقة 1" أو "Sheet1" إذا كانت فارغة
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("ورقة 1");
  if (defaultSheet && ss.getSheets().length > 2 && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

// 4. إضافة قائمة مخصصة في أعلى شيت جوجل عند فتحه لتهيئة الشيت بضغطة زر واحدة
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🌸 متجر GOFY")
      .addItem("✨ تهيئة وتنسيق الجداول تلقائياً", "ensureSheetsSetup")
      .addToUi();
  } catch(e) {}
}
function formatHeaderRow(sheet, numCols, bgColor) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(bgColor);
  range.setFontColor("#FFFFFF");
  range.setFontWeight("bold");
  range.setFontSize(11);
  range.setFontFamily("Cairo");
  range.setHorizontalAlignment("center");
  range.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
}
