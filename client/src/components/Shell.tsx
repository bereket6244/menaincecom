import type { ReactNode } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { useIsDesktop } from '../lib/useIsDesktop';

export function Shell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopShell>{children}</DesktopShell> : <MobileShell>{children}</MobileShell>;
}
