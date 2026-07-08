import menaWordmark from '../assets/menainc-wordmark.png';
import { cx } from '../lib/utils';

export function BrandLogo({
  showIcon = true,
  size = 'md',
  centered = false,
}: {
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
}) {
  const logoSize = size === 'lg' ? 'h-12 w-[190px]' : size === 'sm' ? 'h-8 w-[126px]' : 'h-10 w-[158px]';
  const compactLogoSize = size === 'lg' ? 'h-10 w-[158px]' : size === 'sm' ? 'h-7 w-[110px]' : 'h-9 w-[142px]';

  return (
    <span className={cx('inline-flex min-w-0 items-center', centered && 'justify-center')}>
      <img
        src={menaWordmark}
        alt="mena inc"
        className={cx('shrink-0 object-contain', showIcon ? logoSize : compactLogoSize)}
      />
    </span>
  );
}
