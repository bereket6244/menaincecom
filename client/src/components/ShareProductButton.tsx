import { useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface ShareProductButtonProps {
  name: string;
  compact?: boolean;
  version?: string;
}

export function ShareProductButton({ name, compact = false, version }: ShareProductButtonProps) {
  const { toast } = useApp();
  const previewVersion = version ? String(Date.parse(version) || 1) : '1';

  useEffect(() => {
    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.get('v') === previewVersion) return;
    pageUrl.searchParams.set('v', previewVersion);
    window.history.replaceState(window.history.state, '', pageUrl);
  }, [previewVersion]);

  const share = async () => {
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set('v', previewVersion);
    const url = `${pageUrl.origin}${pageUrl.pathname}?v=${encodeURIComponent(previewVersion)}`;
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
        : 'mena-press inline-flex min-h-10 items-center gap-2 px-1 text-[13.5px] font-bold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-pink'}
    >
      <Share2 className={compact ? 'h-4.5 w-4.5' : 'h-4 w-4'} aria-hidden="true" />
      {!compact && <span>Share</span>}
    </button>
  );
}
