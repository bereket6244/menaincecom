const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function responsiveImage(src?: string, sizes = '100vw') {
  if (!src) return { src };
  const prefix = `${BASE}/uploads/`;
  if (!src.startsWith(prefix)) return { src };
  const file = src.slice(prefix.length);
  if (!/^[\w.-]+\.(?:jpe?g|png|webp|avif)$/i.test(file)) return { src };
  const url = (width: number) => `${BASE}/api/image?file=${encodeURIComponent(file)}&width=${width}`;
  return {
    src: url(640),
    srcSet: [320, 640, 960, 1280].map((width) => `${url(width)} ${width}w`).join(', '),
    sizes,
  };
}
