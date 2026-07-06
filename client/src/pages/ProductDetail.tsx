import { DesktopProductDetail } from './DesktopProductDetail';
import { MobileProductDetail } from './MobileProductDetail';
import { useIsDesktop } from '../lib/useIsDesktop';

export function ProductDetail() {
  return useIsDesktop() ? <DesktopProductDetail /> : <MobileProductDetail />;
}
