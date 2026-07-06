import { DesktopCatalog } from './DesktopCatalog';
import { MobileCatalog } from './MobileCatalog';
import { useIsDesktop } from '../lib/useIsDesktop';

export function Catalog() {
  return useIsDesktop() ? <DesktopCatalog /> : <MobileCatalog />;
}
