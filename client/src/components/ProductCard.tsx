import type { Product } from '../lib/types';
import { DesktopProductCard } from './DesktopProductCard';
import { MobileProductCard } from './MobileProductCard';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useNavigate } from 'react-router-dom';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  return isDesktop ? (
    <DesktopProductCard
      product={product}
      priority={priority}
      onOpen={(p) => navigate(`/product/${p.id}`)}
      onQuickAdd={(p) => navigate(`/product/${p.id}`)}
    />
  ) : (
    <MobileProductCard product={product} priority={priority} />
  );
}
