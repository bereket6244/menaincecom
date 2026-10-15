import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StorefrontAd } from '../lib/types';

export const EXAMPLE_AD: StorefrontAd = {
  enabled: true,
  label: 'From Mena',
  title: 'Your love story. One beautiful link.',
  description: 'Discover digital wedding invitations by Mena.',
  buttonText: 'Explore',
  href: '/digital-invitations',
};

export function validAdHref(href: string) {
  if (/^\/(?![\/\\])[^\\\s]*$/.test(href)) return true;
  if (!/^https?:\/\/[^\s\\]+$/i.test(href)) return false;
  try { return Boolean(new URL(href).hostname); } catch { return false; }
}

export function AdStrip({ ad = EXAMPLE_AD, previewMode = 'responsive' }: { ad?: StorefrontAd; previewMode?: 'responsive' | 'mobile' | 'desktop' }) {
  if (!ad.enabled || !ad.title.trim() || !validAdHref(ad.href)) return null;
  const label = ad.label ?? 'From Mena';
  const content = <>
    <span className="min-w-0 flex-1">
      {label.trim() && <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.18em] text-rose-200">{label}</span>}
      <span className={`block truncate font-semibold ${previewMode === 'mobile' ? 'text-[12px]' : previewMode === 'desktop' ? 'text-sm' : 'text-[12px] sm:text-sm'}`}>{ad.title}</span>
    </span>
    <span className={`${previewMode === 'desktop' ? 'block' : 'hidden'} text-[13px] text-rose-100 ${previewMode === 'responsive' ? 'lg:block' : ''}`}>{ad.description}</span>
    <span className={`ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white py-2 font-bold text-[#62243c] ${previewMode === 'mobile' ? 'px-3 text-[11px]' : previewMode === 'desktop' ? 'ml-4 px-4 text-xs' : 'px-3 text-[11px] sm:ml-4 sm:px-4 sm:text-xs'}`}>{ad.buttonText || 'Explore'}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
  </>;
  const className = `mx-auto flex max-w-[1560px] items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white ${previewMode === 'mobile' ? 'h-14 px-4' : previewMode === 'desktop' ? 'h-16 px-10' : 'h-14 px-4 sm:h-16 lg:px-10 2xl:px-12'}`;
  return <aside aria-label="Mena promotion" className="bg-gradient-to-r from-[#482635] via-[#71314c] to-[#923d60] text-white">
    {ad.href.startsWith('/') ? <Link to={ad.href} className={className}>{content}</Link> : <a href={ad.href} className={className} target="_blank" rel="noopener noreferrer">{content}</a>}
  </aside>;
}
