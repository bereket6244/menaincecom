import type { Category, Product } from './types';

export function productCategoryIds(product: Pick<Product, 'categoryId' | 'categoryIds'>): string[] {
  return [...new Set([...(product.categoryIds || []), product.categoryId].filter(Boolean))];
}

export function productCategoryNames(product: Pick<Product, 'categoryId' | 'categoryIds'>, categories: Category[]): string[] {
  const byId = new Map(categories.map((category) => [category.id, category.name]));
  return productCategoryIds(product).map((id) => byId.get(id)).filter((name): name is string => !!name);
}

export function firstProductCategory<T extends Category>(product: Pick<Product, 'categoryId' | 'categoryIds'>, categories: T[]): T | undefined {
  const ids = productCategoryIds(product);
  return ids.map((id) => categories.find((category) => category.id === id)).find((category): category is T => !!category);
}
