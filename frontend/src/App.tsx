import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DocumentsPage from './pages/DocumentsPage';
import NewDocumentPage from './pages/NewDocumentPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import UsersPage from './pages/UsersPage';
import SearchPage from './pages/SearchPage';
import StockPage from './pages/StockPage';
import InventoryPage from './pages/InventoryPage';
import InventoryDetailPage from './pages/InventoryDetailPage';
import InventoryIntroDetailPage from './pages/InventoryIntroDetailPage';
import LocationsPage from './pages/LocationsPage';
import AuditPage from './pages/AuditPage';
import WarehousesPage from './pages/WarehousesPage';
import ProductsPage from './pages/ProductsPage';
import ContainersPage from './pages/ContainersPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      {/* Documents */}
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/new"
        element={
          <ProtectedRoute>
            <NewDocumentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/:id"
        element={
          <ProtectedRoute>
            <DocumentDetailPage />
          </ProtectedRoute>
        }
      />
      {/* Search & Stock */}
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <StockPage />
          </ProtectedRoute>
        }
      />
      {/* Inventory */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER', 'WAREHOUSE']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/:id"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER', 'WAREHOUSE']}>
            <InventoryDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory-intro/:id"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER', 'WAREHOUSE']}>
            <InventoryIntroDetailPage />
          </ProtectedRoute>
        }
      />
      {/* Admin */}
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <LocationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <AuditPage />
          </ProtectedRoute>
        }
      />
      {/* Warehouses & Products */}
      <Route
        path="/warehouses"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <WarehousesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/containers"
        element={
          <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
            <ContainersPage />
          </ProtectedRoute>
        }
      />
      {/* Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
