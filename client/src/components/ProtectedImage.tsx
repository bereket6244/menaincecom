import type { ImgHTMLAttributes } from 'react';
import { cx } from '../lib/utils';

export function ProtectedImage({ className, onContextMenu, onDragStart, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      draggable={false}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(event);
      }}
      onDragStart={(event) => {
        event.preventDefault();
        onDragStart?.(event);
      }}
      className={cx('mena-protected-photo', className)}
    />
  );
}
