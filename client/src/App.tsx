import { lazy, Suspense } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';

const Catalog = lazy(() => import('./pages/Catalog').then((m) => ({ default: m.Catalog })));
const ProductDetail = lazy(() => import('./pages/ProductDetail').then((m) => ({ default: m.ProductDetail })));
const Gallery = lazy(() => import('./pages/Gallery').then((m) => ({ default: m.Gallery })));
const OrderSummary = lazy(() => import('./pages/OrderSummary').then((m) => ({ default: m.OrderSummary })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Account = lazy(() => import('./pages/Login').then((m) => ({ default: m.Account })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const AdminShell = lazy(() => import('./admin/AdminShell').then((m) => ({ default: m.AdminShell })));
const OrdersAdmin = lazy(() => import('./admin/OrdersAdmin').then((m) => ({ default: m.OrdersAdmin })));
const ProductsAdmin = lazy(() => import('./admin/ProductsAdmin').then((m) => ({ default: m.ProductsAdmin })));
const CategoriesAdmin = lazy(() => import('./admin/CategoriesAdmin').then((m) => ({ default: m.CategoriesAdmin })));
const GalleryAdmin = lazy(() => import('./admin/GalleryAdmin').then((m) => ({ default: m.GalleryAdmin })));
const BusinessAdmin = lazy(() => import('./admin/BusinessAdmin').then((m) => ({ default: m.BusinessAdmin })));
const LeadsAdmin = lazy(() => import('./admin/LeadsAdmin').then((m) => ({ default: m.LeadsAdmin })));
const AdminsAdmin = lazy(() => import('./admin/AdminsAdmin').then((m) => ({ default: m.AdminsAdmin })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-muted">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<OrdersAdmin />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="gallery" element={<GalleryAdmin />} />
          <Route path="business" element={<BusinessAdmin />} />
          <Route path="leads" element={<LeadsAdmin />} />
          <Route path="admins" element={<AdminsAdmin />} />
        </Route>
        <Route
          path="*"
          element={
            <Shell>
              <Routes>
                <Route path="/" element={<Navigate to="/catalog" replace />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/order" element={<OrderSummary />} />
                <Route path="/login" element={<Login />} />
                <Route path="/account" element={<Account />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<Navigate to="/catalog" replace />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>
    </Suspense>
  );
}
