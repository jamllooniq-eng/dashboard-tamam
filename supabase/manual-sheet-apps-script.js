/**
 * تمام شوب - سكربت الشيت الآخر (طلبات المنتجات اليدوية)
 *
 * الأعمدة بنفس ترتيب شيت الطلبات الحالي:
 * اسم المنتج | اسم المستلم | الرقم | المحافظة | العنوان | معرف المنتج | الكمية | السعر الكلي | الملاحظات | التاريخ
 *
 * يكتب في أول تبويب بالشيت. إذا كان الشيت فارغاً يضيف العناوين تلقائياً.
 * يمنع التكرار بدون أي أعمدة إضافية (نفس الرقم + نفس المنتج خلال 5 دقائق يُتجاهل).
 *
 * بعد أي تعديل على هذا الكود:
 * Deploy > Manage deployments > ✏️ > Version: New version > Deploy
 * (الرابط يبقى نفسه)
 */

const HEADERS = ['اسم المنتج', 'اسم المستلم', 'الرقم', 'المحافظة', 'العنوان', 'معرف المنتج', 'الكمية', 'السعر الكلي', 'الملاحظات', 'التاريخ'];
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const ORDER_ID_MEMORY_MS = 60 * 60 * 1000;
const TIMEZONE = 'Asia/Baghdad';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const order = JSON.parse(e.postData.contents);
    const now = Date.now();

    // Duplicate memory kept in script properties (small; old entries removed every time)
    const props = PropertiesService.getScriptProperties();
    const memory = readMemory_(props, now);

    // 1) Same order sent twice (automatic retry) -> ignore
    if (order.orderId && memory.ids[order.orderId]) {
      return json_({ ok: true, duplicate: true });
    }

    // 2) Same phone + same product within 5 minutes -> ignore
    const dupKey = String(order.phone || '') + '_' + String(order.productId || '');
    if (memory.recent[dupKey] && now - memory.recent[dupKey] < DUPLICATE_WINDOW_MS) {
      return json_({ ok: true, duplicate: true });
    }

    const sheet = getSheet_();
    const phone = String(order.phone || '').replace(/^0/, ''); // 07701234567 -> 7701234567 (same as current sheet)

    sheet.appendRow([
      order.productName || '',
      order.name || '',
      phone ? Number(phone) : '',
      order.governorate || '',
      order.address || '',
      order.productId || '',
      Number(order.quantity) || 1,
      Number(order.totalPrice) || 0,
      '', // الملاحظات: تبقى فارغة
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd H:mm:ss'),
    ]);

    if (order.orderId) memory.ids[order.orderId] = now;
    memory.recent[dupKey] = now;
    props.setProperty('memory', JSON.stringify(memory));

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function readMemory_(props, now) {
  let memory = { ids: {}, recent: {} };
  try {
    memory = JSON.parse(props.getProperty('memory') || '{}');
  } catch (e) {}
  memory.ids = memory.ids || {};
  memory.recent = memory.recent || {};
  Object.keys(memory.ids).forEach(function (k) {
    if (now - memory.ids[k] > ORDER_ID_MEMORY_MS) delete memory.ids[k];
  });
  Object.keys(memory.recent).forEach(function (k) {
    if (now - memory.recent[k] > DUPLICATE_WINDOW_MS) delete memory.recent[k];
  });
  return memory;
}

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
