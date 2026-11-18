import { useEffect, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DesktopProductDetail } from './DesktopProductDetail';
import { MobileProductDetail } from './MobileProductDetail';
import { useIsDesktop } from '../lib/useIsDesktop';
import { trackEvent } from '../lib/observability';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  useEffect(() => {
    if (id) trackEvent('product_view', { product_id: id });
  }, [id]);
  return useIsDesktop() ? <DesktopProductDetail /> : <MobileProductDetail />;
}
