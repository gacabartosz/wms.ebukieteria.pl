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

## Deployment

Serwer produkcyjny:
- **IP:** 91.228.197.34
- **Domena:** wms.ebukieteria.pl
- **SSL:** Let's Encrypt
- **Process Manager:** PM2
- **Web Server:** Nginx

---

**Wersja:** 1.0.0  
**Autor:** eBukieteria.pl Team
