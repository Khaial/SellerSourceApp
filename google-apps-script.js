// ─────────────────────────────────────────────────────────────
//  SellerSource — Google Apps Script
//  Paste this into: Google Sheet → Extensions → Apps Script
//  Then deploy as Web App (Anyone can access)
// ─────────────────────────────────────────────────────────────

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Auto-create headers on first run
  if (sheet.getLastRow() === 0) {
    var headers = ['Name', 'Email', 'Phone', 'State', 'Contact Medium', 'Notes', 'Next Contact', 'Date Added'];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#185FA5');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // Append the new contact row
  sheet.appendRow([
    e.parameter.name          || '',
    e.parameter.email         || '',
    e.parameter.phone         || '',
    e.parameter.state         || '',
    e.parameter.contactMedium || '',
    e.parameter.notes         || '',
    e.parameter.nextContact   || '',
    new Date().toLocaleDateString('en-US')
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
