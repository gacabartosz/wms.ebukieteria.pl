# WMS - Warehouse Management System

System zarządzania magazynem dla eBukieteria.pl z obsługą dokumentów, inwentaryzacji i kuwet.

## Uruchomienie produkcyjne

Aplikacja jest wdrożona na: **https://wms.ebukieteria.pl**

### Dane logowania
| Rola | Telefon | Hasło |
|------|---------|-------|
| Admin | +48000000001 | Admin123! |
| Manager | +48000000002 | Admin123! |
| Warehouse | +48000000003 | Admin123! |

## Architektura

```
wms.ebukieteria.pl/
├── backend/          # Node.js + Express + Prisma + PostgreSQL
│   ├── src/
│   │   ├── config/       # Konfiguracja (env, jwt, database)
│   │   ├── middleware/   # Auth, error handling, rate limiting
│   │   ├── modules/      # Moduły biznesowe
│   │   └── utils/        # Helpery
│   └── prisma/           # Schema bazy danych
│
└── frontend/         # React + TypeScript + Vite + TailwindCSS
    └── src/
        ├── components/   # Komponenty UI
        ├── pages/        # Strony aplikacji
        ├── services/     # API calls
        └── store/        # Zustand store
```

## Konfiguracja serwera

### Porty i usługi
| Element | Wartość |
|---------|---------|
| Backend port | 4021 |
| PM2 nazwa | wms-ebukieteria-backend |
| Baza danych | wms_ebukieteria_db |
| User DB | wms_user |

### Uruchomienie lokalne

**Backend:**
```bash
cd backend
npm install
cp .env.example .env  # Skonfiguruj DATABASE_URL i JWT_SECRET
npx prisma db push
npm run dev           # Port 4021
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev           # Port 5173
```

## Moduły

### Użytkownicy
- Role: ADMIN, MANAGER, WAREHOUSE
- Logowanie przez numer telefonu + hasło
- JWT authentication

### Magazyny i Lokalizacje
- Magazyn (Warehouse): PL1, WA1...
- Lokalizacja (Location): PL1-01-01-01 (magazyn-regał-półka-poziom)
- Statusy lokalizacji: ACTIVE, BLOCKED, COUNTING

### Produkty
- SKU, EAN, nazwa, zdjęcie
- Import z CSV/XLS

### Kuwety (Containers)
Kuwety to mobilne pojemniki na produkty.

**Kod kuwety:** K000001, K000002... (auto-numeracja)

**Hierarchia:**
```
PRODUKT (EAN) → KUWETA (K000001) → PÓŁKA (PL1-01-01-01)
```

### Dokumenty
- **PZ** - Przyjęcie zewnętrzne (towar wchodzi)
- **WZ** - Wydanie zewnętrzne (towar wychodzi)
- **MM** - Przesunięcie międzymagazynowe
- **INV_ADJ** - Korekta inwentaryzacyjna

## Inwentaryzacja - Logika Działania

### Flow inwentaryzacji

```
┌─────────────────┐
│  1. UTWÓRZ      │
│  INWENTARYZACJĘ │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. SKANUJ      │◄──────────────────┐
│  LOKALIZACJĘ    │                   │
│  (np. PL1-01-01)│                   │
└────────┬────────┘                   │
         │                            │
         ▼                            │
┌─────────────────┐                   │
│  3. SKANUJ      │                   │
│  PRODUKTY (EAN) │                   │
│  lub KUWETĘ (K) │                   │
└────────┬────────┘                   │
         │                            │
         ├── Produkt (EAN) ──► +1 szt │
         │                            │
         └── Kuweta (K...) ──► Przypisuje do lokalizacji
                               i ustawia jako aktywną
         │
         ▼
┌─────────────────┐
│  4. ZAKOŃCZ     │───────────────────┘
│  LOKALIZACJĘ    │  (powrót do kroku 2)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. ZAKOŃCZ     │
│  INWENTARYZACJĘ │
└────────┬────────┘
         │
         ▼
     Korekty stanów
```

### Zasady skanowania produktów

**Skanowanie EAN (skaner Zebra TC21):**
1. Skanuj EAN → produkt **od razu zapisuje się z ilością 1**
2. Fokus **automatycznie wraca** do pola skanera
3. Można od razu skanować następny produkt
4. Brak pytania o ilość - szybkie, ciągłe skanowanie

**Ręczny wybór produktu (długopis/autocomplete):**
1. Wpisz nazwę/SKU → wybierz z listy
2. Pojawia się pole **edycji ilości** (domyślnie 1)
3. Zmień ilość → kliknij **Zapisz** lub **Enter**
4. Fokus wraca do skanera

**Edycja ilości już zeskanowanego produktu:**
1. Kliknij na produkt na liście
2. Zmień ilość w modalu
3. Kliknij **Zapisz**
4. Fokus automatycznie wraca do skanera

**Przywracanie sesji po wygaśnięciu ekranu:**
- Sesja inwentaryzacji zapisuje się w localStorage
- Po wygaszeniu ekranu / odświeżeniu strony:
  - Komunikat "Przywrócono sesję: [lokalizacja]"
  - Produkty z tej lokalizacji ładowane z serwera
  - Można kontynuować skanowanie
- Sesja ważna **24 godziny**

### Dźwięki

| Akcja | Dźwięk |
|-------|--------|
| Skan lokalizacji | Podwójny bip (1000Hz + 1400Hz) |
| Skan produktu OK | Pojedynczy bip (1200Hz) |
| Skan kuwety | Podwójny bip |
| Błąd (produkt nie istnieje) | Niski dźwięk (300Hz → 200Hz) |
| Zakończenie lokalizacji | Bip ostrzegawczy (800Hz) |

## API Endpoints

### Auth
- `POST /api/auth/login` - Logowanie
- `POST /api/auth/refresh` - Odświeżenie tokenu
- `POST /api/auth/logout` - Wylogowanie
- `GET /api/auth/me` - Dane zalogowanego użytkownika

### Containers (Kuwety)
- `GET /api/containers` - Lista kuwet
- `GET /api/containers/:id` - Szczegóły kuwety
- `GET /api/containers/by-barcode/:barcode` - Znajdź po kodzie
- `POST /api/containers` - Utwórz kuwetę
- `POST /api/containers/bulk` - Utwórz wiele kuwet
- `PUT /api/containers/:id/move` - Przenieś kuwetę

### Inventory
- `GET /api/inventory` - Lista inwentaryzacji
- `GET /api/inventory/:id` - Szczegóły
- `POST /api/inventory` - Utwórz inwentaryzację
- `GET /api/inventory/:id/location?locationBarcode=...` - Info o lokalizacji
- `POST /api/inventory/:id/lines` - Dodaj pozycję
- `POST /api/inventory/:id/complete` - Zakończ
- `POST /api/inventory/:id/cancel` - Anuluj

### Inne
- `GET /api/products` - Produkty
- `GET /api/locations` - Lokalizacje
- `GET /api/warehouses` - Magazyny
- `GET /api/stock` - Stany magazynowe
- `GET /api/documents` - Dokumenty
- `GET /api/audit` - Historia operacji
- `GET /api/users` - Użytkownicy

## Technologie

**Backend:**
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT (jsonwebtoken)
- bcrypt
- Zod (validation)

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- React Query (TanStack Query)
- Zustand (state management)
- React Router
- Lucide React (ikony)
- Web Audio API (dźwięki skanowania)
- PWA (Progressive Web App)

## Baza danych

### Modele
- User
- Warehouse
- Location
- Product
- Container
- Stock
- Document
- DocumentLine
- InventoryCount
- InventoryLine
- AuditLog
- Settings

### Schemat (uproszczony)
```
User ─────┬───── AuditLog
          │
Warehouse ┼───── Location ─────┬───── Stock
          │                    │
          │                    ├───── Container
          │                    │
          └───── Document ─────┼───── DocumentLine
                               │
Product ───────────────────────┼───── InventoryLine
                               │
InventoryCount ────────────────┘
```

## 📦 Inwentaryzacja "Nowe Produkty" (Inventory Intro)

### Opis funkcjonalności

**Inwentaryzacja "Nowe Produkty"** to specjalny typ inwentaryzacji przeznaczony do szybkiego przyjmowania nowych towarów z automatyczną wyceną i kategoryzacją.

### Funkcje

#### 1. **Wybór Magazynu i Lokalizacji**
- Użytkownik widzi **tylko przypisane magazyny**
- ADMIN widzi wszystkie magazyny
- Po wyborze magazynu → wybór lokalizacji z tego magazynu
- Format lokalizacji: `TAR-KWIACIARNIA-01` (kod-magazynu-numer)

#### 2. **Dodawanie Produktów ze Zdjęciami**
```
Zdjęcie (WYMAGANE) → Nazwa (opcjonalnie) → Cena brutto → Ilość
```

**Szybkie przyciski nazw (kategorie):**
- Kw.cięty (Kwiat cięty)
- Kw.donic. (Kwiat doniczkowy)
- Art.dek. (Artykuł dekoracyjny)
- Szkło, Ceramika, Kw.sztucz., Znicz
- Wkłady, Świece, Nawozy, Ziemia
- Don.plast., Wiklina

#### 3. **Auto-przypisywanie VAT**

Nazwa produktu automatycznie definiuje stawkę VAT:

| Kategoria | VAT |
|-----------|-----|
| Kwiat cięty, Kwiat doniczkowy | **8%** |
| Ziemia, Nawozy 8% | **8%** |
| Artykuł dekoracyjny, Szkło, Ceramika | **23%** |
| Kwiat sztuczny, Znicz, Wkłady, Świece | **23%** |
| Nawozy 23%, Doniczka plastikowa, Wiklina | **23%** |
| **Domyślnie** | **23%** |

#### 4. **Panel ADMIN - Edycja VAT i Podzielnika** 🔒

**Tylko dla ADMIN!** Rozwijany panel do edycji przed eksportem:

**Tabela edycji produktów:**
| Lp | Nazwa | Brutto | VAT ↓ | Podzielnik ↓ | Netto zakupu |
|----|-------|--------|-------|--------------|--------------|
| 1  | Róża  | 100 zł | 8%    | /2.0         | 46.30 zł     |

**Elementy panelu:**
- ✅ Dropdown VAT: 8% / 23% (indywidualnie per produkt)
- ✅ Dropdown Podzielnik: /1.5, /2, /2.5, /3 (indywidualnie per produkt)
- ✅ Podgląd przeliczenia z formułą
- ✅ Przyciski eksportu Excel i PDF

**Formuła przeliczania:**
```
Cena netto zakupu = Cena brutto / (1 + VAT%) / Podzielnik
```

**Przykład:**
- Produkt: 100 zł brutto
- VAT: 8%
- Podzielnik: /2
- **Netto zakupu: 100 / 1.08 / 2 = 46.30 zł**

#### 5. **Tracking Użytkowników**

Każdy produkt zapisuje:
- **Kto dodał** + data i godzina
- **Kto edytował** + data i godzina (jeśli był edytowany)

Wyświetlane na liście produktów:
```
👤 Violetta • 28.12 09:50
✏️ Edyt: Administrator • 28.12 14:44
```

#### 6. **Zdjęcia Produktów**

**Format przechowywania:** Base64 Data URL (bezpośrednio w bazie)
```javascript
imageUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
```

**Zalety:**
- ✅ Brak potrzeby zewnętrznego storage (AWS S3, etc.)
- ✅ Zdjęcia zawsze dostępne z produktem
- ✅ Możliwość użycia w PDF/Excel
- ✅ Offline-ready (PWA)

**Możliwe wykorzystanie zdjęć:**
- 📄 **Eksport PDF** - zdjęcia produktów w raporcie (✅ działa)
- 📊 **Eksport Excel** - możliwość dodania (🔄 do zaimplementowania)
- 🖼️ **Galeria inwentaryzacji** - podgląd wszystkich zdjęć
- 🔍 **OCR** - rozpoznawanie tekstu ze zdjęć (ceny, nazwy)
- 📸 **Porównanie przed/po** - weryfikacja jakości towaru
- 🏷️ **Automatyczne tagowanie** - AI rozpoznawanie kategorii

#### 7. **Eksport**

**Excel (.xlsx):**
- Wszystkie produkty z podziałem na arkusze per inwentaryzacja
- Kolumny: Lp, Nazwa, Ilość, Jedn., Cena brutto, Cena netto zakupu, Wartość
- Suma brutto i suma netto zakupu
- Możliwość dodania zdjęć miniatur (🔄 planowane)

**PDF:**
- Raport ze zdjęciami produktów
- Informacje o magazynie, dacie, użytkowniku
- Pełna lista produktów z cenami
- Podpisy i pieczątki

### Flow Inwentaryzacji "Nowe Produkty"

```
┌──────────────────────┐
│ 1. WYBÓR MAGAZYNU    │
│ (tylko przypisane)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. WYBÓR LOKALIZACJI │
│ (z wybranego magazynu)│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. NAZWA             │
│ "Nowa inwentaryzacja"│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ 4. DODAWANIE PRODUKTÓW           │
├──────────────────────────────────┤
│ a) Zrób zdjęcie (kamera/upload)  │
│ b) Nazwa (auto-sugestie)         │
│    └─► Auto-VAT 8% lub 23%       │
│ c) Cena brutto                   │
│ d) Ilość + jednostka             │
│ e) EAN (opcjonalnie)             │
└──────────┬───────────────────────┘
           │
           │ (wielokrotne dodawanie)
           │
           ▼
┌──────────────────────────────────┐
│ 5. PANEL ADMIN (opcjonalnie)     │
├──────────────────────────────────┤
│ • Edycja VAT per produkt         │
│ • Edycja podzielnika per produkt │
│ • Podgląd netto zakupu           │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 6. ZAKOŃCZENIE       │
│ • Eksport Excel      │
│ • Eksport PDF        │
└──────────────────────┘
```

### API Endpoints (Inventory Intro)

```typescript
// Magazyny i lokalizacje użytkownika
GET /api/inventory-intro/my-warehouses
GET /api/inventory-intro/my-locations?warehouseId=xxx

// CRUD Inwentaryzacji
POST /api/inventory-intro
  {
    name: string,
    warehouseId: string,
    defaultLocationBarcode: string
  }

GET /api/inventory-intro
GET /api/inventory-intro/:id

// Produkty
POST /api/inventory-intro/:id/lines
  {
    imageUrl: string,        // base64 data URL
    priceBrutto: number,
    quantity: number,
    unit: string,
    name?: string,
    ean?: string
  }

PATCH /api/inventory-intro/:id/lines/:lineId
  {
    quantity?: number,
    priceBrutto?: number,
    name?: string,
    ean?: string,
    vatRate?: number,        // ADMIN edycja VAT
    divider?: number         // ADMIN edycja podzielnika
  }

DELETE /api/inventory-intro/:id/lines/:lineId

// Eksport (ADMIN only)
POST /api/inventory-intro/export/excel
  {
    inventoryIds: string[],
    vatRate: number,         // Globalna stawka VAT
    divider: number          // Globalny podzielnik
  }

POST /api/inventory-intro/export/pdf
  {
    inventoryIds: string[],
    vatRate: number,
    divider: number
  }

// Zakończenie
POST /api/inventory-intro/:id/complete
```

### Struktura bazy danych (InventoryIntroLine)

```typescript
{
  id: uuid,
  inventoryIntroId: uuid,

  // Dane produktu
  imageUrl: string,              // base64 data URL
  priceBrutto: Decimal(10,2),
  quantity: number,
  unit: string,                  // 'szt', 'kg', 'opak'
  ean: string | null,
  tempSku: string,               // TEMP-timestamp-index
  tempName: string,              // Produkt-0001 lub user input

  // VAT i marża (NOWE!)
  vatRate: number,               // 8 lub 23 (auto z nazwy)
  divider: Decimal(4,2),         // 1.5, 2, 2.5, 3... (domyślnie 2)

  // Tracking użytkowników (NOWE!)
  createdById: uuid,             // Kto dodał
  createdBy: User,
  createdAt: DateTime,

  updatedById: uuid | null,      // Kto edytował
  updatedBy: User | null,
  updatedAt: DateTime | null
}
```

### Bezpieczeństwo i Uprawnienia

| Akcja | ADMIN | WAREHOUSE |
|-------|-------|-----------|
| Widzi wszystkie magazyny | ✅ | ❌ (tylko przypisane) |
| Widzi wszystkie lokalizacje | ✅ | ❌ (tylko z przypisanych magazynów) |
| Tworzy inwentaryzację | ✅ | ✅ |
| Dodaje produkty | ✅ | ✅ |
| Edytuje VAT/podzielnik | ✅ | ❌ |
| Panel ADMIN widoczny | ✅ | ❌ |
| Eksportuje Excel/PDF | ✅ | ❌ |
| Widzi tracking użytkowników | ✅ | ✅ |

### Testy i Weryfikacja

**100% spójność frontend-backend zweryfikowana:**

✅ Magazyny - tylko przypisane dla użytkowników
✅ Lokalizacje - filtrowane per magazyn
✅ VAT - auto-przypisywanie z nazwy (8% / 23%)
✅ Divider - zapisywany indywidualnie per produkt
✅ User tracking - createdBy/updatedBy z datami
✅ Zdjęcia - base64 w bazie, gotowe do PDF/Excel
✅ Przeliczanie cen - formuła: brutto / (1+VAT%) / divider
✅ Panel ADMIN - edycja VAT i podzielnika

**Przykładowe dane testowe:**
```sql
-- Produkt z auto-VAT 8%
Kwiat cięty: 100 zł brutto → 100 / 1.08 / 2 = 46.30 zł netto

-- Produkt z auto-VAT 23%
Ceramika: 100 zł brutto → 100 / 1.23 / 3 = 27.10 zł netto

-- Tracking
Created by: Violetta @ 2025-12-28 09:50
Updated by: Administrator @ 2025-12-28 14:44
```

---

## Deployment

Serwer produkcyjny:
- **IP:** 91.228.197.34
- **Domena:** wms.ebukieteria.pl
- **SSL:** Let's Encrypt
- **Process Manager:** PM2
- **Web Server:** Nginx

---

**Wersja:** 2.1.0
**Ostatnia aktualizacja:** 2025-12-31
**Autor:** eBukieteria.pl Team
