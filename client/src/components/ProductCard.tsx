import type { Product } from '../lib/types';
import { DesktopProductCard } from './DesktopProductCard';
import { MobileProductCard } from './MobileProductCard';
import { useIsDesktop } from '../lib/useIsDesktop';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopProductCard product={product} priority={priority} /> : <MobileProductCard product={product} priority={priority} />;
}
