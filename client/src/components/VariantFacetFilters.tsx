import { Check } from 'lucide-react';
import { cx } from '../lib/utils';
import { toggleVariantOption, type Facet, type VariantFilters } from '../lib/variantFacets';

/**
 * Catalog filter sections for the product variant groups — Size, Color, or any
 * custom group an admin adds. Colour options render as swatches when the label is
 * a colour the browser can paint ("ivory", "#c2185b") and as labelled chips when it
 * is a trade name it cannot ("Sage"), so the row stays one visual language.
 */
export function VariantFacetFilters({
  facets, filters, onChange, sectionClassName, size = 'h-8',
}: {
  facets: Facet[];
  filters: VariantFilters;
  onChange: (next: VariantFilters) => void;
  sectionClassName: string;
  /** Height of the colour swatches and chips — mobile wants a larger tap target. */
  size?: 'h-8' | 'h-9';
}) {
  return (
    <>
      {facets.map((facet) => {
        const selected = filters[facet.key] || [];
        return (
          <section key={facet.key} className={sectionClassName}>
            <h2 className="mb-3 text-sm font-extrabold capitalize">{facet.name}</h2>
            <div className={cx(facet.isColor ? 'flex flex-wrap gap-2' : 'space-y-2.5')}>
              {facet.options.map((option) => {
                const checked = selected.includes(option.value);
                const toggle = () => onChange(toggleVariantOption(filters, facet.key, option.value));

                if (facet.isColor) {
                  return option.swatch ? (
                    <button
                      key={option.value}
                      type="button"
                      onClick={toggle}
                      title={option.label}
                      aria-pressed={checked}
                      className={cx(
                        // Mutually exclusive ring widths: stacking ring-1 and ring-2
                        // leaves the selected state looking exactly like the idle one.
                        'mena-press flex aspect-square items-center justify-center rounded-full transition',
                        size,
                        checked ? 'ring-2 ring-pink ring-offset-2' : 'ring-1 ring-black/15'
                      )}
                      style={{ background: option.swatch }}
                    >
                      {checked && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
                      <span className="sr-only">{option.label}</span>
                    </button>
                  ) : (
                    <button
                      key={option.value}
                      type="button"
                      onClick={toggle}
                      aria-pressed={checked}
                      className={cx(
                        'mena-press rounded-full border px-3 text-[13px] transition',
                        size,
                        checked ? 'border-pink bg-pink/10 font-bold text-pink' : 'border-[#d8cfc8] bg-white text-ink/80'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                }

                return (
                  <label key={option.value} className="mena-press flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink/80">
                    <input type="checkbox" checked={checked} onChange={toggle} className="sr-only" />
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-[5px] border', checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white')}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
