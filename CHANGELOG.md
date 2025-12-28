# Changelog

Wszystkie istotne zmiany w projekcie WMS eBukieteria.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/).

## [2.0.0] - 2025-12-28

### ✨ Dodane

#### Inwentaryzacja "Nowe Produkty" - Kompleksowy System
- **Wybór magazynu i lokalizacji** przed utworzeniem inwentaryzacji
  - Użytkownicy widzą tylko przypisane magazyny (ADMIN widzi wszystkie)
  - Lokalizacje filtrowane per magazyn
  - Walidacja uprawnień na poziomie backendu

- **Słownik kategorii produktów** z szybkimi przyciskami
  - 13 kategorii: Kw.cięty, Kw.donic., Art.dek., Szkło, Ceramika, itd.
  - Każda kategoria z tooltipem pełnej nazwy

- **Auto-przypisywanie VAT** na podstawie nazwy produktu
  - Kwiat cięty, Kwiat doniczkowy, Ziemia → VAT 8%
  - Pozostałe kategorie → VAT 23%
  - Funkcja `getVatRateFromName()` w backendzie

- **Indywidualny podzielnik marży** dla każdego produktu
  - Pole `divider` w InventoryIntroLine (domyślnie 2)
  - Edytowalny per produkt w panelu ADMIN
  - Opcje: /1.5, /2, /2.5, /3 lub własna wartość

- **Panel ADMIN - Edycja VAT i Podzielnika** 🔒
  - Widoczny tylko dla ADMIN
  - Tabela edycji wszystkich produktów
  - Dropdown VAT (8% / 23%) per produkt
  - Dropdown Podzielnik (/1.5, /2, /2.5, /3) per produkt
  - Live preview przeliczenia ceny netto zakupu
  - Formuła: `Netto zakupu = Brutto / (1 + VAT%) / Podzielnik`
  - Przyciski eksportu Excel i PDF z niestandardowymi ustawieniami

- **User Tracking** - Audyt zmian
  - `createdById` + `createdAt` - kto i kiedy dodał produkt
  - `updatedById` + `updatedAt` - kto i kiedy edytował produkt
  - Wyświetlanie na liście produktów z datami (format: dd.MM HH:mm)
  - Ikony użytkowników (User, Edit2) dla łatwej identyfikacji

### 🔧 Zmienione

- **Struktura bazy danych** - dodane pola:
  - `InventoryIntroLine.vatRate` (Integer, default 23)
  - `InventoryIntroLine.divider` (Decimal 4,2, default 2)
  - `InventoryIntroLine.updatedById` (UUID, nullable)
  - `InventoryIntroLine.updatedAt` (DateTime, nullable)

- **Backend API** - rozszerzone endpointy:
  - `GET /inventory-intro/my-warehouses` - magazyny użytkownika
  - `GET /inventory-intro/my-locations?warehouseId=xxx` - lokalizacje użytkownika
  - `PATCH /inventory-intro/:id/lines/:lineId` - obsługa `vatRate` i `divider`
  - `POST /inventory-intro/export/excel` - parametr `divider`
  - `POST /inventory-intro/export/pdf` - parametr `divider`

- **Frontend** - InventoryPage.tsx:
  - Usunięty `warehousesService.getWarehouses()` (wszyscy widzieli wszystkie)
  - Dodany `inventoryIntroService.getUserWarehouses()` (tylko przypisane)
  - Formularz "Nowa inwentaryzacja" z dropdownem magazynów i lokalizacji

- **Frontend** - InventoryIntroDetailPage.tsx:
  - Usunięty dropdown "Kategoria produktu (auto VAT)"
  - Nazwa produktu definiuje VAT
  - Szybkie przyciski z 13 kategoriami (skróty)
  - Panel ADMIN z tabelą edycji VAT/divider
  - Wyświetlanie createdBy, updatedBy z datami

### 🐛 Naprawione

- **Bezpieczeństwo** - użytkownicy WAREHOUSE widzieli wszystkie magazyny
  - Naprawiono: teraz widzą tylko przypisane magazyny
  - ADMIN dalej widzi wszystkie
  - Walidacja na poziomie backendu (`getUserWarehouses()`)

- **Spójność danych** - brak trackingu użytkowników
  - Dodano pola `createdById/updatedById` do schematu
  - 100% produktów ma przypisanego twórcę
  - Produkty edytowane mają przypisanego edytora

### 📊 Testy

**Przeprowadzone testy kompleksowe:**
- ✅ Test 1: Utworzenie inwentaryzacji z wyborem magazynu/lokalizacji
- ✅ Test 2: Dodanie produktów z różnymi kategoriami
- ✅ Test 3: Sprawdzenie danych w bazie (VAT, divider, user, daty)
- ✅ Test 4: Edycja VAT i podzielnika w panelu ADMIN
- ✅ Test 5: Weryfikacja spójności całego flow
- ✅ Test 6: Weryfikacja spójności frontend-backend

**Wyniki:**
- 100% pokrycie wymaganych pól w bazie
- 100% spójność frontend-backend
- Auto-VAT działa (Kwiat cięty → 8%, Ceramika → 23%)
- Przeliczanie cen poprawne (formuła zweryfikowana)

### 📸 Zdjęcia

**Format przechowywania:** Base64 Data URL w bazie danych

**Możliwe wykorzystanie (planowane):**
- 📊 Eksport Excel z miniaturami zdjęć
- 🖼️ Galeria inwentaryzacji
- 🔍 OCR - rozpoznawanie tekstu ze zdjęć
- 📸 Porównanie przed/po
- 🏷️ AI tagowanie kategorii

---

## [1.0.0] - 2024-12-18

### ✨ Dodane

- System zarządzania magazynem (WMS)
- Moduł użytkowników (ADMIN, MANAGER, WAREHOUSE)
- Magazyny i lokalizacje (barcode format)
- Produkty (SKU, EAN, nazwa, zdjęcie)
- Kuwety (containers) - mobilne pojemniki
- Dokumenty (PZ, WZ, MM, INV_ADJ)
- Inwentaryzacja standardowa
- Inwentaryzacja "Nowe Produkty" (podstawowa wersja)
- API REST z JWT auth
- Frontend React + TypeScript + Vite
- Backend Node.js + Express + Prisma
- PostgreSQL database
- Dźwięki skanowania (Web Audio API)
- PWA support
- Nginx + PM2 deployment
- SSL (Let's Encrypt)

---

**Format wersjonowania:** [MAJOR.MINOR.PATCH]
- MAJOR - zmiany łamiące kompatybilność
- MINOR - nowe funkcje (kompatybilne wstecz)
- PATCH - poprawki błędów
