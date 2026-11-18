import { Share2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface ShareProductButtonProps {
  name: string;
  compact?: boolean;
}

export function ShareProductButton({ name, compact = false }: ShareProductButtonProps) {
  const { toast } = useApp();

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} | mena inc`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Product link copied.');
    } catch {
      window.prompt('Copy product link', url);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={compact ? `Share ${name}` : undefined}
      title={compact ? 'Share product' : undefined}
      className={compact
        ? 'mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-pink'
        : 'mena-press inline-flex h-10 items-center gap-2 rounded-xl border border-edge bg-white px-3.5 text-sm font-bold text-ink hover:border-pink hover:text-pink focus-visible:outline-2 focus-visible:outline-pink'}
    >
      <Share2 className="h-4.5 w-4.5" aria-hidden="true" />
      {!compact && <span>Share product</span>}
    </button>
  );
}
