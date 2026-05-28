/**
 * Google Sheets → Backend webhook
 * Spreadsheet → Extensions → Apps Script
 * Webhook URL: https://yourdomain.com/api/webhook/sheets
 */
const WEBHOOK_URL = 'https://yourdomain.com/api/webhook/sheets';
const WEBHOOK_SECRET = 'your_webhook_secret';

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Sheet1') return;
  const row = e.range.getRow();
  if (row < 2) return;
  syncRowToBackend(sheet, row);
}

function syncRowToBackend(sheet, row) {
  const values = sheet.getRange(row, 1, 1, 13).getValues()[0];
  const payload = {
    event: 'row_added',
    row: row,
    data: {
      num: values[0],
      date: values[1],
      time: values[2],
      first_name: values[3],
      last_name: values[4],
      birth_date: values[5],
      phone: values[6],
      address: values[7],
      referrer: values[8],
      provider: values[9],
      service: values[10],
      price: values[11],
      payment_type: values[12],
    },
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  UrlFetchApp.fetch(WEBHOOK_URL, options);
}
