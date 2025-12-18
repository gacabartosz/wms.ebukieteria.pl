import ExcelJS from 'exceljs';
import { Response } from 'express';

interface Column {
  header: string;
  key: string;
  width?: number;
}

export const exportToExcel = async (
  res: Response,
  filename: string,
  sheetName: string,
  columns: Column[],
  data: any[]
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WMS System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  // Set columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Set response headers
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
};

// Enhanced inventory export with summary
export const exportInventoryToExcel = async (
  res: Response,
  filename: string,
  inventoryData: {
    name: string;
    warehouse?: string;
    status: string;
    createdAt: Date;
    completedAt?: Date | null;
    lines: Array<{
      location: string;
      sku: string;
      name: string;
      systemQty: number;
      countedQty: number;
      difference: number;
      countedBy: string;
      countedAt: string;
    }>;
  }
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WMS System';
  workbook.created = new Date();

  // ============== Sheet 1: Summary ==============
  const summarySheet = workbook.addWorksheet('Podsumowanie');

  // Calculate summary stats
  const totalLines = inventoryData.lines.length;
  const totalSystemQty = inventoryData.lines.reduce((sum, l) => sum + l.systemQty, 0);
  const totalCountedQty = inventoryData.lines.reduce((sum, l) => sum + l.countedQty, 0);
  const totalDifference = totalCountedQty - totalSystemQty;

  const shortages = inventoryData.lines.filter((l) => l.difference < 0);
  const surpluses = inventoryData.lines.filter((l) => l.difference > 0);
  const matches = inventoryData.lines.filter((l) => l.difference === 0);

  const totalShortageQty = shortages.reduce((sum, l) => sum + Math.abs(l.difference), 0);
  const totalSurplusQty = surpluses.reduce((sum, l) => sum + l.difference, 0);

  // Summary header
  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = `INWENTARYZACJA: ${inventoryData.name}`;
  summarySheet.getCell('A1').font = { bold: true, size: 16 };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };

  // Basic info
  const infoRows = [
    ['Magazyn:', inventoryData.warehouse || '-'],
    ['Status:', inventoryData.status === 'COMPLETED' ? 'Zakończona' : inventoryData.status],
    ['Data utworzenia:', inventoryData.createdAt.toISOString().split('T')[0]],
    ['Data zakończenia:', inventoryData.completedAt ? new Date(inventoryData.completedAt).toISOString().split('T')[0] : '-'],
  ];

  let row = 3;
  infoRows.forEach(([label, value]) => {
    summarySheet.getCell(`A${row}`).value = label;
    summarySheet.getCell(`A${row}`).font = { bold: true };
    summarySheet.getCell(`B${row}`).value = value;
    row++;
  });

  row += 2;

  // Stats section
  summarySheet.getCell(`A${row}`).value = 'STATYSTYKI';
  summarySheet.getCell(`A${row}`).font = { bold: true, size: 14 };
  row += 2;

  const statsRows = [
    ['Zliczonych pozycji:', totalLines],
    ['Stan systemowy (suma):', totalSystemQty],
    ['Stan zliczony (suma):', totalCountedQty],
    ['Różnica całkowita:', totalDifference],
    ['', ''],
    ['Pozycje zgodne:', matches.length],
    ['Pozycje z niedoborem:', shortages.length],
    ['Pozycje z nadwyżką:', surpluses.length],
    ['', ''],
    ['Suma niedoborów (szt):', totalShortageQty],
    ['Suma nadwyżek (szt):', totalSurplusQty],
  ];

  statsRows.forEach(([label, value]) => {
    summarySheet.getCell(`A${row}`).value = label;
    summarySheet.getCell(`A${row}`).font = { bold: true };
    summarySheet.getCell(`B${row}`).value = value;

    // Color coding for differences
    if (label === 'Różnica całkowita:') {
      summarySheet.getCell(`B${row}`).font = {
        bold: true,
        color: { argb: totalDifference < 0 ? 'FFFF0000' : totalDifference > 0 ? 'FF00AA00' : 'FF000000' },
      };
    }
    row++;
  });

  summarySheet.getColumn('A').width = 25;
  summarySheet.getColumn('B').width = 20;

  // ============== Sheet 2: All Data ==============
  const dataSheet = workbook.addWorksheet('Wszystkie pozycje');

  dataSheet.columns = [
    { header: 'Lokalizacja', key: 'location', width: 20 },
    { header: 'SKU', key: 'sku', width: 25 },
    { header: 'Nazwa produktu', key: 'name', width: 40 },
    { header: 'Stan systemowy', key: 'systemQty', width: 15 },
    { header: 'Stan zliczony', key: 'countedQty', width: 15 },
    { header: 'Różnica', key: 'difference', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Zliczył', key: 'countedBy', width: 20 },
    { header: 'Data', key: 'countedAt', width: 15 },
  ];

  // Style header
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data with conditional formatting
  inventoryData.lines.forEach((line) => {
    const rowData = dataSheet.addRow({
      ...line,
      status: line.difference < 0 ? 'NIEDOBÓR' : line.difference > 0 ? 'NADWYŻKA' : 'OK',
    });

    // Color code difference column
    const diffCell = rowData.getCell('difference');
    const statusCell = rowData.getCell('status');

    if (line.difference < 0) {
      diffCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      statusCell.font = { color: { argb: 'FFFF0000' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEEE' } };
    } else if (line.difference > 0) {
      diffCell.font = { color: { argb: 'FF00AA00' }, bold: true };
      statusCell.font = { color: { argb: 'FF00AA00' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEFFEE' } };
    }
  });

  dataSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };

  // ============== Sheet 3: Shortages Only ==============
  if (shortages.length > 0) {
    const shortagesSheet = workbook.addWorksheet('Niedobory');

    shortagesSheet.columns = [
      { header: 'Lokalizacja', key: 'location', width: 20 },
      { header: 'SKU', key: 'sku', width: 25 },
      { header: 'Nazwa produktu', key: 'name', width: 40 },
      { header: 'Stan systemowy', key: 'systemQty', width: 15 },
      { header: 'Stan zliczony', key: 'countedQty', width: 15 },
      { header: 'Brakuje (szt)', key: 'shortage', width: 15 },
    ];

    shortagesSheet.getRow(1).font = { bold: true };
    shortagesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCCC' },
    };

    shortages.forEach((line) => {
      shortagesSheet.addRow({
        ...line,
        shortage: Math.abs(line.difference),
      });
    });

    // Add total row
    const totalRow = shortagesSheet.addRow({
      location: '',
      sku: '',
      name: 'RAZEM NIEDOBORY:',
      systemQty: shortages.reduce((sum, l) => sum + l.systemQty, 0),
      countedQty: shortages.reduce((sum, l) => sum + l.countedQty, 0),
      shortage: totalShortageQty,
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEEE' } };
  }

  // ============== Sheet 4: Surpluses Only ==============
  if (surpluses.length > 0) {
    const surplusesSheet = workbook.addWorksheet('Nadwyżki');

    surplusesSheet.columns = [
      { header: 'Lokalizacja', key: 'location', width: 20 },
      { header: 'SKU', key: 'sku', width: 25 },
      { header: 'Nazwa produktu', key: 'name', width: 40 },
      { header: 'Stan systemowy', key: 'systemQty', width: 15 },
      { header: 'Stan zliczony', key: 'countedQty', width: 15 },
      { header: 'Nadwyżka (szt)', key: 'surplus', width: 15 },
    ];

    surplusesSheet.getRow(1).font = { bold: true };
    surplusesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCFFCC' },
    };

    surpluses.forEach((line) => {
      surplusesSheet.addRow({
        ...line,
        surplus: line.difference,
      });
    });

    // Add total row
    const totalRow = surplusesSheet.addRow({
      location: '',
      sku: '',
      name: 'RAZEM NADWYŻKI:',
      systemQty: surpluses.reduce((sum, l) => sum + l.systemQty, 0),
      countedQty: surpluses.reduce((sum, l) => sum + l.countedQty, 0),
      surplus: totalSurplusQty,
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEFFEE' } };
  }

  // Set response headers
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
};
