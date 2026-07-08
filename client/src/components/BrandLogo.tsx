import menaIcon from '../assets/menainc-icon.png';
import { cx } from '../lib/utils';

const MENA_FONT = '"Berlin Sans FB Demi", "Berlin Sans FB", "Arial Rounded MT Bold", Arial, sans-serif';
const INC_FONT = 'Calibri, "Segoe UI", Arial, sans-serif';

export function BrandLogo({
  showIcon = true,
  size = 'md',
  centered = false,
}: {
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
}) {
  const iconSize = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const menaSize = size === 'lg' ? 'text-[28px]' : size === 'sm' ? 'text-[22px]' : 'text-[27px]';
  const incSize = size === 'lg' ? 'text-[25px]' : size === 'sm' ? 'text-[20px]' : 'text-[24px]';

  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2.5', centered && 'justify-center')}>
      {showIcon && <img src={menaIcon} alt="" aria-hidden="true" className={cx('shrink-0 object-contain', iconSize)} />}
      <span className="sr-only">mena Inc.</span>
      <span aria-hidden="true" className="inline-flex items-baseline whitespace-nowrap leading-none">
        <span className={cx('tracking-[-0.02em] text-green', menaSize)} style={{ fontFamily: MENA_FONT, fontWeight: 700 }}>
          mena
        </span>
        <span className={cx('ml-1 text-pink', incSize)} style={{ fontFamily: INC_FONT, fontWeight: 700 }}>
          Inc.
        </span>
      </span>
    </span>
  );
}
