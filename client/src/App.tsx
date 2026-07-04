import { Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { Gallery } from './pages/Gallery';
import { OrderSummary } from './pages/OrderSummary';
import { Login, Account } from './pages/Login';
import { Contact } from './pages/Contact';
import { AdminShell } from './admin/AdminShell';
import { OrdersAdmin } from './admin/OrdersAdmin';
import { ProductsAdmin } from './admin/ProductsAdmin';
import { CategoriesAdmin } from './admin/CategoriesAdmin';
import { GalleryAdmin } from './admin/GalleryAdmin';
import { HomepageAdmin } from './admin/HomepageAdmin';
import { BusinessAdmin } from './admin/BusinessAdmin';
import { LeadsAdmin } from './admin/LeadsAdmin';
import { AdminsAdmin } from './admin/AdminsAdmin';

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<OrdersAdmin />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="categories" element={<CategoriesAdmin />} />
        <Route path="gallery" element={<GalleryAdmin />} />
        <Route path="homepage" element={<HomepageAdmin />} />
        <Route path="business" element={<BusinessAdmin />} />
        <Route path="leads" element={<LeadsAdmin />} />
        <Route path="admins" element={<AdminsAdmin />} />
      </Route>
      <Route
        path="*"
        element={
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/order" element={<OrderSummary />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<Account />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}
