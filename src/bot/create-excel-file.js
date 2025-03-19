const ExcelJS = require('exceljs');
const path = require('path');
const { isValidISODateString } = require('./helpers/valid-iso-date-string');

const createExcelFile = async (header, data, fileName, title) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);

  if (data.length === 0) {
    worksheet.addRow(['No data found']);
    const filePath = path.join(__dirname, fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  const formattedHeaders = Object.keys({ ...header, timestamp: 0 }).map(key =>
    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
  );

  const headerMapping = {};
  Object.keys({ ...header, timestamp: 0 }).forEach((key, index) => {
    headerMapping[key] = formattedHeaders[index];
  });

  worksheet.addRow(formattedHeaders);

  data.forEach(item => {
    const row = [];
    Object.keys(headerMapping).forEach(originalKey => {
      const value = item[originalKey] ?? "";

      if (typeof value === 'string' && isValidISODateString(value)) {
        const date = new Date(value);
        const formattedDate = date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) + ' ' +
          date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        row.push(formattedDate);
      } else {
        row.push(value);
      }

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