import { useEffect, useRef } from 'react';

/**
 * Replays a short staggered settle animation over the product grid whenever the
 * filtered result changes, so the catalog visibly re-flows behind the filter
 * window instead of swapping instantly.
 *
 * The cards are animated in place rather than remounted, which keeps their photos
 * loaded. Skips the first run so the cards' own entrance animation still plays,
 * and stays out of the way when the visitor asks for reduced motion.
 */
export function useResultAnimation<T extends HTMLElement>(signature: string) {
  const ref = useRef<T>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const first = previous.current === null;
    const changed = previous.current !== signature;
    previous.current = signature;
    if (first || !changed) return;

    const container = ref.current;
    if (!container || typeof container.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const animations = [...container.children].map((child, index) =>
      child.animate(
        [
          { opacity: 0, transform: 'translateY(8px) scale(0.985)' },
          { opacity: 1, transform: 'none' },
        ],
        // 'backwards' holds the start frame through the stagger delay but releases the
        // card back to the stylesheet once finished, so nothing can strand it at opacity 0.
        { duration: 260, delay: Math.min(index, 8) * 30, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }
      )
    );

    return () => animations.forEach((animation) => animation.cancel());
  }, [signature]);

  return ref;
}
