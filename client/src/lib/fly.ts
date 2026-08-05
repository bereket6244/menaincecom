/**
 * Animate a small heart from a tapped like-button up to the "Liked" nav target,
 * so the shopper sees where saved designs collect. Targets the mobile header
 * icon first, then the desktop nav link — whichever is mounted.
 */
export function flyToLiked(origin: HTMLElement | null): void {
  if (!origin) return;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    pulse(likedTarget());
    return;
  }
  const target = likedTarget();
  if (!target) return;

  const from = origin.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - startX;
  const dy = to.top + to.height / 2 - startY;

  const clone = document.createElement('div');
  clone.textContent = '♥';
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${startX - 14}px`,
    top: `${startY - 14}px`,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    lineHeight: '1',
    color: '#ee317b',
    zIndex: '95',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 6px 16px rgba(238,49,123,.45))',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(clone);

  clone.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 44}px) scale(1.3)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.25, offset: 1 },
    ],
    { duration: 820, easing: 'cubic-bezier(.4,.15,.2,1)' }
  ).onfinish = () => {
    clone.remove();
    pulse(target);
  };
}

function likedTarget(): HTMLElement | null {
  return (
    document.getElementById('mena-liked-icon') ||
    document.getElementById('desktop-liked-target')
  );
}

function pulse(target: HTMLElement | null): void {
  if (!target) return;
  target.classList.remove('mena-pop');
  void target.offsetWidth;
  target.classList.add('mena-pop');
}
