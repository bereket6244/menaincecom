import { useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface ShareProductButtonProps {
  name: string;
  version?: string;
}

export function ShareProductButton({ name, version }: ShareProductButtonProps) {
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
      aria-label={`Share ${name}`}
      className="product-utility-action"
    >
      <Share2 className="h-5 w-5" aria-hidden="true" />
      <span>Share</span>
    </button>
  );
}
