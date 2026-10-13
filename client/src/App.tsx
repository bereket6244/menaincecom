import { lazy, Suspense } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Loader2 } from 'lucide-react';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { DigitalInvitations } from './pages/DigitalInvitations';

const Gallery = lazy(() => import('./pages/Gallery').then((m) => ({ default: m.Gallery })));
const OrderSummary = lazy(() => import('./pages/OrderSummary').then((m) => ({ default: m.OrderSummary })));
const Wishlist = lazy(() => import('./pages/Wishlist').then((m) => ({ default: m.Wishlist })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Account = lazy(() => import('./pages/Login').then((m) => ({ default: m.Account })));
const TelegramCallback = lazy(() => import('./pages/TelegramCallback').then((m) => ({ default: m.TelegramCallback })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const AdminShell = lazy(() => import('./admin/AdminShell').then((m) => ({ default: m.AdminShell })));
const OrdersAdmin = lazy(() => import('./admin/OrdersAdmin').then((m) => ({ default: m.OrdersAdmin })));
const ProductsAdmin = lazy(() => import('./admin/ProductsAdmin').then((m) => ({ default: m.ProductsAdmin })));
const ComplimentaryItemsAdmin = lazy(() => import('./admin/ComplimentaryItemsAdmin').then((m) => ({ default: m.ComplimentaryItemsAdmin })));
const CategoriesAdmin = lazy(() => import('./admin/CategoriesAdmin').then((m) => ({ default: m.CategoriesAdmin })));
const GalleryAdmin = lazy(() => import('./admin/GalleryAdmin').then((m) => ({ default: m.GalleryAdmin })));
const BusinessAdmin = lazy(() => import('./admin/BusinessAdmin').then((m) => ({ default: m.BusinessAdmin })));
const DigitalInvitationsAdmin = lazy(() => import('./admin/DigitalInvitationsAdmin').then((m) => ({ default: m.DigitalInvitationsAdmin })));
const LeadsAdmin = lazy(() => import('./admin/LeadsAdmin').then((m) => ({ default: m.LeadsAdmin })));
const AdminsAdmin = lazy(() => import('./admin/AdminsAdmin').then((m) => ({ default: m.AdminsAdmin })));

function RouteFallback() {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-sm font-semibold text-muted">
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-pink" />
      Loading page…
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
          <Route path="complimentary-items" element={<ComplimentaryItemsAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="gallery" element={<GalleryAdmin />} />
          <Route path="digital-invitations" element={<DigitalInvitationsAdmin />} />
          <Route path="business" element={<BusinessAdmin />} />
          <Route path="leads" element={<LeadsAdmin />} />
          <Route path="admins" element={<AdminsAdmin />} />
        </Route>
        <Route
          path="*"
          element={
            <Shell>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/catalog" replace />} />
                  <Route path="/catalog" element={<Catalog />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/digital-invitations" element={<DigitalInvitations />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/order" element={<OrderSummary />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/telegram/callback" element={<TelegramCallback />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="*" element={<Navigate to="/catalog" replace />} />
                </Routes>
              </Suspense>
            </Shell>
          }
        />
      </Routes>
    </Suspense>
  );
}
