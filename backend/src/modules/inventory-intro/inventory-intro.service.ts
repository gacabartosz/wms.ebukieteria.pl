import prisma from '../../config/database.js';
import { Decimal } from '@prisma/client/runtime/library';
import ExcelJS from 'exceljs';

// ============================================
// HELPERS
// ============================================

async function generateNumber(): Promise<string> {
  const count = await prisma.inventoryIntro.count();
  return `INV-INTRO-${String(count + 1).padStart(3, '0')}`;
}

async function generateUniqueSku(): Promise<string> {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const sku = `INV-${timestamp}-${random}`;

  // Sprawdź czy SKU już istnieje
  const existing = await prisma.product.findUnique({ where: { sku } });
  if (existing) {
    return generateUniqueSku(); // Rekurencyjnie generuj nowy
  }
  return sku;
}

function generateTempName(lineIndex: number): string {
  return `Produkt-${String(lineIndex).padStart(4, '0')}`;
}

// ============================================
// SERVICE
// ============================================

export const inventoryIntroService = {

  // CREATE - Utwórz nową inwentaryzację wprowadzającą
  async create(data: {
    name: string;
    warehouseId: string;
    defaultLocationBarcode: string;
    userId: string;
  }) {
    const number = await generateNumber();

    return prisma.inventoryIntro.create({
      data: {
        number,
        name: data.name,
        warehouseId: data.warehouseId,
        defaultLocationBarcode: data.defaultLocationBarcode,
        createdById: data.userId,
      },
      include: {
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
  },

  // GET ALL - Lista inwentaryzacji
  async getAll(params?: { warehouseId?: string; status?: string }) {
    return prisma.inventoryIntro.findMany({
      where: {
        ...(params?.warehouseId && { warehouseId: params.warehouseId }),
        ...(params?.status && { status: params.status as any }),
      },
      include: {
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // GET BY ID - Szczegóły inwentaryzacji
  async getById(id: string) {
    return prisma.inventoryIntro.findUnique({
      where: { id },
      include: {
        warehouse: true,
        createdBy: { select: { id: true, name: true } },
        lines: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  // ADD LINE - Dodaj produkt do inwentaryzacji
  async addLine(
    id: string,
    data: {
      imageUrl: string;       // WYMAGANE
      priceBrutto: number;    // WYMAGANE
      quantity: number;       // WYMAGANE, default 1
      unit: string;           // WYMAGANE, default "szt"
      ean?: string;           // opcjonalne
      name?: string;          // opcjonalne - nazwa produktu
    },
    userId: string            // Kto dodaje
  ) {
    // Walidacja
    if (!data.imageUrl) {
      throw new Error('Zdjecie jest wymagane');
    }
    if (!data.priceBrutto || data.priceBrutto <= 0) {
      throw new Error('Cena brutto jest wymagana i musi byc wieksza od 0');
    }
    if (!data.quantity || data.quantity < 1) {
      throw new Error('Ilosc musi byc co najmniej 1');
    }

    // Sprawdź inwentaryzację
    const intro = await prisma.inventoryIntro.findUnique({
      where: { id },
      include: { _count: { select: { lines: true } } },
    });

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }
    if (intro.status !== 'IN_PROGRESS') {
      throw new Error('Inwentaryzacja jest juz zakonczona');
    }

    // Generuj tymczasowy SKU i nazwę (użyj nazwy od użytkownika jeśli podana)
    const lineIndex = intro._count.lines + 1;
    const tempSku = `TEMP-${Date.now()}-${lineIndex}`; // Tymczasowy, zostanie nadpisany przy zakończeniu
    const tempName = data.name?.trim() || generateTempName(lineIndex);

    // Utwórz linię z informacją kto dodał
    return prisma.inventoryIntroLine.create({
      data: {
        inventoryIntroId: id,
        imageUrl: data.imageUrl,
        priceBrutto: new Decimal(data.priceBrutto),
        quantity: data.quantity,
        unit: data.unit || 'szt',
        ean: data.ean || null,
        tempSku,
        tempName,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
  },

  // UPDATE LINE - Edytuj pozycję (ilość, cenę, nazwę, ean)
  async updateLine(
    introId: string,
    lineId: string,
    data: {
      quantity?: number;
      priceBrutto?: number;
      name?: string;
      ean?: string;
    },
    userId?: string
  ) {
    const intro = await prisma.inventoryIntro.findUnique({
      where: { id: introId },
    });

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }
    if (intro.status !== 'IN_PROGRESS') {
      throw new Error('Nie mozna edytowac pozycji w zakonczonej inwentaryzacji');
    }

    // Pobierz obecne dane linii do logowania
    const existingLine = await prisma.inventoryIntroLine.findUnique({
      where: { id: lineId },
    });

    const updateData: any = {};
    const changes: string[] = [];

    if (data.quantity !== undefined && data.quantity >= 1) {
      if (existingLine && existingLine.quantity !== data.quantity) {
        changes.push(`ilość: ${existingLine.quantity} → ${data.quantity}`);
      }
      updateData.quantity = data.quantity;
    }
    if (data.priceBrutto !== undefined && data.priceBrutto > 0) {
      if (existingLine && Number(existingLine.priceBrutto) !== data.priceBrutto) {
        changes.push(`cena: ${existingLine.priceBrutto} → ${data.priceBrutto}`);
      }
      updateData.priceBrutto = new Decimal(data.priceBrutto);
    }
    if (data.name !== undefined) {
      const newName = data.name.trim() || undefined;
      if (existingLine && existingLine.tempName !== newName) {
        changes.push(`nazwa: "${existingLine.tempName}" → "${newName || ''}"`);
      }
      updateData.tempName = newName;
    }
    if (data.ean !== undefined) {
      const newEan = data.ean.trim() || null;
      if (existingLine && existingLine.ean !== newEan) {
        changes.push(`EAN: "${existingLine.ean || ''}" → "${newEan || ''}"`);
      }
      updateData.ean = newEan;
    }

    // Loguj zmiany
    if (changes.length > 0) {
      const userName = userId ? (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name : 'Unknown';
      console.log(`[INVENTORY-INTRO] Edycja produktu ${lineId} przez ${userName}: ${changes.join(', ')}`);
    }

    return prisma.inventoryIntroLine.update({
      where: { id: lineId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
  },

  // DELETE LINE - Usuń pozycję
  async deleteLine(introId: string, lineId: string) {
    const intro = await prisma.inventoryIntro.findUnique({
      where: { id: introId },
    });

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }
    if (intro.status !== 'IN_PROGRESS') {
      throw new Error('Nie mozna usuwac pozycji z zakonczonej inwentaryzacji');
    }

    return prisma.inventoryIntroLine.delete({
      where: { id: lineId },
    });
  },

  // COMPLETE - Zakończ inwentaryzację (tworzy produkty)
  async complete(id: string) {
    const intro = await this.getById(id);

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }
    if (intro.status !== 'IN_PROGRESS') {
      throw new Error('Inwentaryzacja jest juz zakonczona');
    }
    if (intro.lines.length === 0) {
      throw new Error('Brak produktow do zapisania');
    }

    // Znajdź lub utwórz lokalizację
    let location = await prisma.location.findFirst({
      where: { barcode: intro.defaultLocationBarcode },
    });

    if (!location) {
      // Utwórz lokalizację
      location = await prisma.location.create({
        data: {
          barcode: intro.defaultLocationBarcode,
          warehouseId: intro.warehouseId,
          rack: '01',
          shelf: '01',
          level: '01',
          zone: 'INTRO',
        },
      });
    }

    // Transakcja - utwórz produkty i stany
    await prisma.$transaction(async (tx) => {
      for (const line of intro.lines) {
        // 1. Generuj unikalny SKU dla produktu
        const uniqueSku = await generateUniqueSku();

        // 2. Utwórz produkt
        const product = await tx.product.create({
          data: {
            sku: uniqueSku,
            name: line.tempName,
            ean: line.ean || `NOEAN-${uniqueSku}`,
            imageUrl: line.imageUrl,
            priceBrutto: line.priceBrutto,
            unit: line.unit,
            source: 'INVENTORY_INTRO',
          },
        });

        // 2. Utwórz stan magazynowy
        await tx.stock.create({
          data: {
            productId: product.id,
            locationId: location!.id,
            qty: line.quantity,
          },
        });

        // 3. Połącz linię z produktem
        await tx.inventoryIntroLine.update({
          where: { id: line.id },
          data: { productId: product.id },
        });
      }

      // 4. Zakończ inwentaryzację
      await tx.inventoryIntro.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    });

    return this.getById(id);
  },

  // DELETE - Usuń inwentaryzację (tylko ADMIN)
  async delete(id: string, userId: string) {
    const intro = await prisma.inventoryIntro.findUnique({
      where: { id },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }

    // Pobierz nazwę użytkownika do logowania
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Transakcja - usuń produkty, stany, linie i inwentaryzację
    await prisma.$transaction(async (tx) => {
      // Jeśli inwentaryzacja była zakończona, usuń utworzone produkty i stany
      if (intro.status === 'COMPLETED') {
        for (const line of intro.lines) {
          if (line.productId) {
            // Usuń stany magazynowe produktu
            await tx.stock.deleteMany({
              where: { productId: line.productId },
            });
            // Usuń produkt
            await tx.product.delete({
              where: { id: line.productId },
            });
          }
        }
      }

      // Usuń wszystkie linie inwentaryzacji
      await tx.inventoryIntroLine.deleteMany({
        where: { inventoryIntroId: id },
      });

      // Usuń inwentaryzację
      await tx.inventoryIntro.delete({
        where: { id },
      });
    });

    console.log(`[INVENTORY-INTRO] USUNIETO inwentaryzacje ${intro.number} (${intro.name}) przez ${user?.name || 'Unknown'}. Status: ${intro.status}, Produktow: ${intro.lines.length}`);

    return { message: 'Inwentaryzacja zostala usunieta' };
  },

  // CANCEL - Anuluj inwentaryzację
  async cancel(id: string) {
    const intro = await prisma.inventoryIntro.findUnique({
      where: { id },
    });

    if (!intro) {
      throw new Error('Inwentaryzacja nie znaleziona');
    }
    if (intro.status !== 'IN_PROGRESS') {
      throw new Error('Mozna anulowac tylko inwentaryzacje w trakcie');
    }

    return prisma.inventoryIntro.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  },

  // GET SUMMARY - Podsumowanie
  async getSummary(id: string) {
    const intro = await this.getById(id);
    if (!intro) return null;

    const totalValue = intro.lines.reduce((sum, line) => {
      return sum + Number(line.priceBrutto) * line.quantity;
    }, 0);

    const totalQuantity = intro.lines.reduce((sum, line) => sum + line.quantity, 0);
    const withImages = intro.lines.filter((l) => l.imageUrl).length;
    const withEan = intro.lines.filter((l) => l.ean).length;

    return {
      ...intro,
      summary: {
        productsCount: intro.lines.length,
        totalQuantity,
        totalValue: totalValue.toFixed(2),
        withImages,
        withEan,
      },
    };
  },

  // GET DEFAULT WAREHOUSE - Pobierz domyślny magazyn TAR-KWIACIARNIA
  // Jeśli użytkownik ma przypisane magazyny, zwróć pierwszy z nich
  async getDefaultWarehouse(userId?: string) {
    // Jeśli podano userId, sprawdź przypisane magazyny
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          assignedWarehouses: {
            include: {
              warehouse: true,
            },
            orderBy: {
              assignedAt: 'asc',
            },
          },
        },
      });

      // Jeśli użytkownik ma przypisane magazyny, zwróć pierwszy
      if (user && user.assignedWarehouses.length > 0) {
        return user.assignedWarehouses[0].warehouse;
      }

      // ADMIN może korzystać z dowolnego magazynu - zwróć TAR-KWIACIARNIA jako domyślny
      if (user && user.role === 'ADMIN') {
        // Fall through to default warehouse
      } else if (user && user.assignedWarehouses.length === 0) {
        // Użytkownik bez przypisanych magazynów - zwróć błąd
        throw new Error('Nie masz przypisanych magazynów. Skontaktuj się z administratorem.');
      }
    }

    // Domyślny magazyn TAR-KWIACIARNIA
    let warehouse = await prisma.warehouse.findFirst({
      where: { code: 'TAR-KWIACIARNIA' },
    });

    // Jeśli nie istnieje, utwórz
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          code: 'TAR-KWIACIARNIA',
          name: 'Magazyn TAR Kwiaciarnia',
          isActive: true,
        },
      });
    }

    return warehouse;
  },

  // GET USER WAREHOUSES - Pobierz magazyny dostępne dla użytkownika
  async getUserWarehouses(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignedWarehouses: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Użytkownik nie znaleziony');
    }

    // ADMIN widzi wszystkie magazyny
    if (user.role === 'ADMIN') {
      return prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    }

    // Inni użytkownicy widzą tylko przypisane magazyny
    return user.assignedWarehouses.map(uw => uw.warehouse);
  },

  // EXPORT - Eksportuj wybrane inwentaryzacje do XLS/CSV (także w trakcie)
  async exportToExcel(inventoryIds: string[], vatRate: number = 23) {
    // Pobierz wszystkie wybrane inwentaryzacje z liniami (COMPLETED lub IN_PROGRESS)
    const inventories = await prisma.inventoryIntro.findMany({
      where: {
        id: { in: inventoryIds },
        status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
        warehouse: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (inventories.length === 0) {
      throw new Error('Nie znaleziono inwentaryzacji');
    }

    // Twórz workbook Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WMS eBukieteria';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inwentaryzacja');

    // Styl nagłówka
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A90D9' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    // Tytuł
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'INWENTARYZACJA';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // Data eksportu
    worksheet.mergeCells('A2:H2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Data eksportu: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}`;
    dateCell.alignment = { horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Pusta linia
    worksheet.getRow(3).height = 10;

    // Nagłówki kolumn
    const headers = [
      'Lp.',
      'Zdjęcie',
      'Nazwa',
      'EAN',
      'Ilość',
      'Jedn.',
      'Cena brutto',
      'CENA NETTO zakupu',
    ];

    const headerRow = worksheet.getRow(4);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.style = headerStyle;
    });
    headerRow.height = 25;

    // Szerokości kolumn
    worksheet.columns = [
      { width: 6 },   // Lp.
      { width: 15 },  // Zdjęcie
      { width: 35 },  // Nazwa
      { width: 18 },  // EAN
      { width: 10 },  // Ilość
      { width: 8 },   // Jedn.
      { width: 14 },  // Cena brutto
      { width: 18 },  // Cena netto zakupu
    ];

    // Dane
    let rowIndex = 5;
    let lp = 1;

    for (const inventory of inventories) {
      for (const line of inventory.lines) {
        const priceBrutto = Number(line.priceBrutto);
        // CENA NETTO zakupu = (brutto / (1 + VAT%)) / 2
        // Zakładamy że cena brutto zawiera VAT, a cena zakupu netto to połowa ceny netto sprzedaży
        const priceNetto = priceBrutto / (1 + vatRate / 100);
        const priceNettoZakupu = priceNetto / 2;

        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = lp;
        row.getCell(2).value = line.imageUrl ? 'TAK' : 'BRAK';
        row.getCell(3).value = line.tempName;
        row.getCell(4).value = line.ean || '-';
        row.getCell(5).value = line.quantity;
        row.getCell(6).value = line.unit;
        row.getCell(7).value = priceBrutto;
        row.getCell(7).numFmt = '#,##0.00 "zł"';
        row.getCell(8).value = priceNettoZakupu;
        row.getCell(8).numFmt = '#,##0.00 "zł"';

        // Styl danych
        for (let col = 1; col <= 8; col++) {
          row.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          if (col === 3) {
            row.getCell(col).alignment = { horizontal: 'left' };
          } else {
            row.getCell(col).alignment = { horizontal: 'center' };
          }
        }

        rowIndex++;
        lp++;
      }
    }

    // Podsumowanie
    rowIndex++;
    const summaryRow = worksheet.getRow(rowIndex);
    worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
    summaryRow.getCell(1).value = 'RAZEM:';
    summaryRow.getCell(1).font = { bold: true };
    summaryRow.getCell(1).alignment = { horizontal: 'right' };

    // Oblicz sumy
    const totalBrutto = inventories.reduce((sum, inv) =>
      sum + inv.lines.reduce((s, l) => s + Number(l.priceBrutto) * l.quantity, 0), 0);
    const totalNettoZakupu = inventories.reduce((sum, inv) =>
      sum + inv.lines.reduce((s, l) => {
        const netto = Number(l.priceBrutto) / (1 + vatRate / 100) / 2;
        return s + netto * l.quantity;
      }, 0), 0);

    summaryRow.getCell(7).value = totalBrutto;
    summaryRow.getCell(7).numFmt = '#,##0.00 "zł"';
    summaryRow.getCell(7).font = { bold: true };
    summaryRow.getCell(8).value = totalNettoZakupu;
    summaryRow.getCell(8).numFmt = '#,##0.00 "zł"';
    summaryRow.getCell(8).font = { bold: true };

    return workbook;
  },

  // EXPORT CSV
  async exportToCSV(inventoryIds: string[], vatRate: number = 23) {
    const inventories = await prisma.inventoryIntro.findMany({
      where: {
        id: { in: inventoryIds },
        status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      },
      include: {
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (inventories.length === 0) {
      throw new Error('Nie znaleziono inwentaryzacji');
    }

    const headers = ['Lp', 'Nazwa', 'EAN', 'Ilosc', 'Jednostka', 'Cena_brutto', 'Cena_netto_zakupu'];
    const rows: string[] = [headers.join(';')];

    let lp = 1;
    for (const inventory of inventories) {
      for (const line of inventory.lines) {
        const priceBrutto = Number(line.priceBrutto);
        const priceNettoZakupu = (priceBrutto / (1 + vatRate / 100)) / 2;

        rows.push([
          lp.toString(),
          `"${line.tempName}"`,
          line.ean || '',
          line.quantity.toString(),
          line.unit,
          priceBrutto.toFixed(2),
          priceNettoZakupu.toFixed(2),
        ].join(';'));
        lp++;
      }
    }

    return rows.join('\n');
  },
};
