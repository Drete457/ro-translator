const ExcelJS = require('exceljs');
const path = require('path');

const createExcelFile = async (header, data, fileName, title) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);

  if (data.length === 0) {
    worksheet.addRow(['No data found']);
    const filePath = path.join(__dirname, fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /* const formattedHeader = {};
  for (const key in header) {
    const formattedKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    formattedHeader[formattedKey] = header[key];
  }

  const headers = Object.keys(formattedHeader); */
  const headers = Object.keys(header);
  worksheet.addRow(headers);

  data.forEach(item => {
    const row = [];
    headers.forEach(header => {
      row.push(item[header] || '');
    });
    worksheet.addRow(row);
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach(column => {
    column.width = Math.max(20, column.width || 20);
  });

  const filePath = path.join(__dirname, fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { createExcelFile };