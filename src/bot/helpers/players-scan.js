const ExcelJS = require('exceljs');

const normalizeHeader = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

const parseNumber = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return undefined;
  const asNumber = Number(cleaned);
  return Number.isFinite(asNumber) ? asNumber : undefined;
};

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const playerScanHeader = Object.freeze({
  currentPowerScan: undefined,
  powerScan: undefined,
  divisionScan: '',
  allianceIdScan: '',
  allianceTagScan: '',
  meritsScan: undefined,
  unitsKilledScan: undefined,
  unitsDeadScan: undefined,
  unitsHealedScan: undefined,
  t1KillsScan: undefined,
  t2KillsScan: undefined,
  t3KillsScan: undefined,
  t4KillsScan: undefined,
  t5KillsScan: undefined,
  buildingPowerScan: undefined,
  heroPowerScan: undefined,
  legionPowerScan: undefined,
  techPowerScan: undefined,
  victoriesScan: undefined,
  defeatsScan: undefined,
  citySiegesScan: undefined,
  coutedScan: undefined,
  helpsGivenScan: undefined,
  goldScan: undefined,
  goldSpentScan: undefined,
  woodScan: undefined,
  woodSpentScan: undefined,
  oreScan: undefined,
  oreSpentScan: undefined,
  manaScan: undefined,
  manaSpentScan: undefined,
  gemsScan: undefined,
  gemsSpentScan: undefined,
  resourcesGivenScan: undefined,
  resourcesGivenCountScan: undefined,
  cityLevelScan: undefined,
  factionScan: '',
  timestampScan: ''
});

const COLUMN_MAP = {
  'lord id': 'userId',
  'name': 'userName',
  'division': 'divisionScan',
  'alliance id': 'allianceIdScan',
  'alliance tag': 'allianceTagScan',
  'current power': 'currentPowerScan',
  'power': 'powerScan',
  'merits': 'meritsScan',
  'units killed': 'unitsKilledScan',
  'units dead': 'unitsDeadScan',
  'units healed': 'unitsHealedScan',
  't1 kill count': 't1KillsScan',
  't2 kill count': 't2KillsScan',
  't3 kill count': 't3KillsScan',
  't4 kill count': 't4KillsScan',
  't5 kill count': 't5KillsScan',
  'building power': 'buildingPowerScan',
  'hero power': 'heroPowerScan',
  'legion power': 'legionPowerScan',
  'tech power': 'techPowerScan',
  'victories': 'victoriesScan',
  'defeats': 'defeatsScan',
  'city sieges': 'citySiegesScan',
  'couted': 'coutedScan',
  'helps given': 'helpsGivenScan',
  'gold': 'goldScan',
  'gold spent': 'goldSpentScan',
  'wood': 'woodScan',
  'wood spent': 'woodSpentScan',
  'ore': 'oreScan',
  'ore spent': 'oreSpentScan',
  'mana': 'manaScan',
  'mana spent': 'manaSpentScan',
  'gems': 'gemsScan',
  'gems spent': 'gemsSpentScan',
  'resources given': 'resourcesGivenScan',
  'resources given count': 'resourcesGivenCountScan',
  'city level': 'cityLevelScan',
  'faction': 'factionScan'
};

const isNumberField = (field) => !['userName', 'divisionScan', 'allianceIdScan', 'allianceTagScan', 'factionScan', 'timestampScan'].includes(field);

const parsePlayersScanExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  const errors = [];

  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    return { records: [], errors: ["Failed to read Excel file"] };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { records: [], errors: ["No worksheet found in Excel file"] };
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.map(normalizeHeader);
  const headerMap = {};
  headers.forEach((h, idx) => {
    if (COLUMN_MAP[h]) {
      headerMap[idx] = COLUMN_MAP[h];
    }
  });

  const records = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = { source: 'excel', timestampScan: new Date().toISOString() };

    Object.entries(headerMap).forEach(([cellIndex, fieldName]) => {
      const cellValue = row.getCell(Number(cellIndex)).value;
      if (cellValue === undefined || cellValue === null || cellValue === '') return;

      if (fieldName === 'userId') {
        const idValue = parseNumber(cellValue);
        if (idValue !== undefined) {
          record.userId = idValue;
        } else {
          record.userId = stringValue(cellValue);
        }
        return;
      }

      if (isNumberField(fieldName)) {
        record[fieldName] = parseNumber(cellValue);
      } else {
        record[fieldName] = stringValue(cellValue);
      }
    });

    if (!record.userId) {
      errors.push(`Row ${rowNumber}: missing Lord ID / userId`);
      return;
    }

    records.push(record);
  });

  return { records, errors };
};

module.exports = { playerScanHeader, parsePlayersScanExcel };
