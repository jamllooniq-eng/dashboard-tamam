/**
 * تمام شوب - سكربت الشيت الآخر (طلبات المنتجات اليدوية)
 *
 * طريقة التركيب:
 * 1) افتح الشيت الجديد > Extensions > Apps Script
 * 2) احذف أي كود موجود والصق هذا الملف كاملاً ثم احفظ
 * 3) Deploy > New deployment > نوع: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4) انسخ رابط Web app وضعه في Netlify باسم GOOGLE_SHEET_WEBHOOK_URL_MANUAL
 *
 * يمنع تكرار نفس رقم الطلب، ويتجاهل نفس الرقم + نفس المنتج خلال 5 دقائق.
 */

const SHEET_NAME = 'الطلبات';
const HEADERS = ['رقم الطلب', 'التاريخ', 'المنتج', 'رقم المنتج', 'الاسم', 'الهاتف', 'المحافظة', 'العنوان', 'العدد', 'المبلغ الإجمالي', 'ملاحظات', 'الحالة'];
const DUPLICATE_WINDOW_MIN = 5;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const order = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    // Look at the most recent rows only (fast, and nothing grows forever)
    const lastRow = sheet.getLastRow();
    const recentCount = Math.min(300, Math.max(0, lastRow - 1));
    const recent = recentCount > 0
      ? sheet.getRange(lastRow - recentCount + 1, 1, recentCount, HEADERS.length + 1).getValues()
      : [];
    const now = Date.now();
    const phone = String(order.phone || '');
    const productId = String(order.productId || '');

    for (const row of recent) {
      // 1) Same order ID already recorded (e.g. a retry) -> ignore
      if (order.orderId && String(row[0]) === String(order.orderId)) {
        return json_({ ok: true, duplicate: true });
      }
      // 2) Same phone + same product within 5 minutes -> ignore
      const rowPhone = String(row[5]).replace(/^'/, '');
      const rowTime = Number(row[HEADERS.length]) || 0; // hidden timestamp column
      if (rowPhone === phone && String(row[3]) === productId && now - rowTime < DUPLICATE_WINDOW_MIN * 60 * 1000) {
        return json_({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow([
      order.orderId || '',
      order.createdAt || new Date(),
      order.productName || '',
      productId,
      order.name || '',
      "'" + phone, // keep the leading 0
      order.governorate || '',
      order.address || '',
      order.quantity || 1,
      order.totalPrice || 0,
      order.notes || '',
      'جديد',
      now, // hidden column used for the 5-minute duplicate check
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
    sheet.hideColumns(HEADERS.length + 1); // timestamp helper column
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
