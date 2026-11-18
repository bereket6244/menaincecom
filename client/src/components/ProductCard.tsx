import type { Product } from '../lib/types';
import { DesktopProductCard } from './DesktopProductCard';
import { MobileProductCard } from './MobileProductCard';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useNavigate } from 'react-router-dom';

export function ProductCard({ product, priority = false, onQuickAdd }: {
  product: Product;
  priority?: boolean;
  onQuickAdd: (product: Product, selectedPhoto?: string | null) => void;
}) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  return isDesktop ? (
    <DesktopProductCard
      product={product}
      priority={priority}
      onOpen={(p) => navigate(`/product/${p.id}`)}
      onQuickAdd={onQuickAdd}
    />
  ) : (
    <MobileProductCard product={product} priority={priority} onQuickAdd={onQuickAdd} />
  );
}
