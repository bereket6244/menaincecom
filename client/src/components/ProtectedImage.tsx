import type { ImgHTMLAttributes, Ref } from 'react';
import { cx } from '../lib/utils';
import { responsiveImage } from '../lib/images';

export function ProtectedImage({ className, onContextMenu, onDragStart, ...props }: ImgHTMLAttributes<HTMLImageElement> & { ref?: Ref<HTMLImageElement> }) {
  return (
    <img
      {...props}
      {...responsiveImage(props.src, props.sizes)}
      onError={(event) => {
        const img = event.currentTarget;
        if (props.src && img.getAttribute('src') !== props.src) {
          img.removeAttribute('srcset');
          img.src = props.src;
          return;
        }
        props.onError?.(event);
      }}
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
