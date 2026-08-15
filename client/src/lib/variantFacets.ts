import type { Product } from './types';
import { cssColor, isColorGroupName } from './utils';

/** Selected option values, keyed by facet key. Options within a group are OR'd, groups are AND'd. */
export type VariantFilters = Record<string, string[]>;

export type FacetOption = { value: string; label: string; swatch: string | null };
export type Facet = { key: string; name: string; isColor: boolean; options: FacetOption[] };

/** Variant groups are free text, so "Color", "color" and " Colour " must land in one facet. */
export function facetKey(groupName: string): string {
  return groupName.trim().toLowerCase();
}

export function optionValue(label: string): string {
  return label.trim().toLowerCase();
}

export function countVariantFilters(filters: VariantFilters): number {
  return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

export function toggleVariantOption(filters: VariantFilters, key: string, value: string): VariantFilters {
  const current = filters[key] || [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const result = { ...filters };
  if (next.length) result[key] = next;
  else delete result[key];
  return result;
}

/** A product matches when every filtered group has at least one of that group's selected options. */
export function matchesVariantFilters(product: Product, filters: VariantFilters): boolean {
  return Object.entries(filters).every(([key, values]) => {
    if (!values.length) return true;
    const group = (product.variants || []).find((g) => facetKey(g.name) === key);
    if (!group) return false;
    return group.options.some((option) => values.includes(optionValue(option.label)));
  });
}

function omit(filters: VariantFilters, key: string): VariantFilters {
  const rest = { ...filters };
  delete rest[key];
  return rest;
}

/**
 * Facets derived from the catalog itself: every variant group any product defines
 * becomes a filter section, so a new custom group ("Material", "Finish") shows up
 * without a code change.
 *
 * Options are limited to those still reachable under the *other* groups' selections,
 * so picking a filter never leads to an empty grid. Already-selected options are kept
 * even when another group rules them out, otherwise they could not be switched off.
 */
export function buildVariantFacets(products: Product[], filters: VariantFilters = {}): Facet[] {
  // Encounter order — the order admins entered the groups and options — reads better
  // than alphabetical, especially for sizes.
  const order: string[] = [];
  const names = new Map<string, string>();
  const labels = new Map<string, Map<string, string>>();

  for (const product of products) {
    for (const group of product.variants || []) {
      const key = facetKey(group.name);
      if (!key) continue;
      if (!names.has(key)) {
        names.set(key, group.name.trim());
        labels.set(key, new Map());
        order.push(key);
      }
      const groupLabels = labels.get(key) as Map<string, string>;
      for (const option of group.options) {
        const value = optionValue(option.label);
        if (value && !groupLabels.has(value)) groupLabels.set(value, option.label.trim());
      }
    }
  }

  return order
    .map((key) => {
      const reachable = products.filter((product) => matchesVariantFilters(product, omit(filters, key)));
      const available = new Set<string>();
      for (const product of reachable) {
        for (const group of product.variants || []) {
          if (facetKey(group.name) !== key) continue;
          for (const option of group.options) available.add(optionValue(option.label));
        }
      }
      for (const value of filters[key] || []) available.add(value);

      const groupLabels = labels.get(key) as Map<string, string>;
      const name = names.get(key) as string;
      const isColor = isColorGroupName(name);
      const options: FacetOption[] = [...groupLabels.entries()]
        .filter(([value]) => available.has(value))
        .map(([value, label]) => ({ value, label, swatch: isColor ? cssColor(label) : null }));

      return { key, name, isColor, options };
    })
    .filter((facet) => facet.options.length > 0);
}
