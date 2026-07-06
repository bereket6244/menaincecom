import { DesktopOrderSummary } from './DesktopOrderSummary';
import { MobileOrderSummary } from './MobileOrderSummary';
import { useIsDesktop } from '../lib/useIsDesktop';

export function OrderSummary() {
  return useIsDesktop() ? <DesktopOrderSummary /> : <MobileOrderSummary />;
}
