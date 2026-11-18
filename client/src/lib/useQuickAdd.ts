import { useData } from './useData';
import type { CartItem, Product, UniversalComplimentaryItem } from './types';
import { cartPriceEach, withDefaultVariantSelections } from './utils';
import { complimentaryForProduct, productWithResolvedComplimentary } from './complimentary';
import { useApp } from '../store/AppContext';

export function useQuickAdd() {
  const { addToCart, toast } = useApp();
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/complimentary-items');

  return (product: Product, selectedPhoto?: string | null) => {
    const variantSelections = withDefaultVariantSelections(product, {});
    if (selectedPhoto) {
      for (const group of product.variants) {
        const matchingOption = group.options.find((option) => option.photo === selectedPhoto);
        if (matchingOption) variantSelections[group.name] = matchingOption.label;
      }
    }

    const resolved = productWithResolvedComplimentary(product, universalComplimentaryItems || undefined);
    const item: Omit<CartItem, 'key'> = {
      productId: product.id,
      name: product.name,
      photo: selectedPhoto || product.photos[0] || '',
      isAddon: product.isAddon,
      pricingMode: product.pricingMode,
      priceEach: cartPriceEach(product, 1),
      priceTiers: product.priceTiers,
      maxOrderQty: product.maxOrderQty ?? null,
      variantSelections,
      qty: 1,
      note: '',
      complimentaryItems: complimentaryForProduct(resolved, 1),
    };
    const result = addToCart(item);
    toast(result === 'updated' ? 'info' : 'success', result === 'updated'
      ? `${product.name} quantity updated.`
      : `${product.name} added to your cart.`);
  };
}
