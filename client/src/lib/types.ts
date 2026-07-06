export type PricingMode = 'exact' | 'starting' | 'quote';

export interface VariantGroup {
  name: string; // e.g. "Material", "Finish", "Color"
  options: { label: string; photo?: string }[];
}

export interface ComplimentaryItemConfig {
  id: string;
  enabled: boolean;
  name: string;
  type?: 'fixed' | 'multiplier';
  qty: number;
  extraPriceEach?: number | null;
}

export interface UniversalComplimentaryItem extends ComplimentaryItemConfig {
  description?: string;
  photo?: string;
  sortOrder?: number;
}

export interface ComplimentaryCartItem {
  name: string;
  qty: number;
  maxQty?: number;
  freeQty?: number;
  extraQty?: number;
  extraPriceEach?: number | null;
  extraTotal?: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  photos: string[];
  pricingMode: PricingMode;
  price: number | null; // ETB; used by 'exact' and 'starting'
  variants: VariantGroup[];
  isAddon: boolean; // complimentary/add-on item (entrance cards, schedule cards…)
  suggestedAddonIds: string[];
  complimentaryItems?: ComplimentaryItemConfig[];
  universalComplimentaryItemIds?: string[];
  featured: boolean;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  photo?: string;
  sortOrder: number;
}

export interface GalleryItem {
  id: string;
  photo: string;
  caption: string;
  sortOrder: number;
}

export interface CartItem {
  key: string; // productId + variant hash
  productId: string;
  name: string;
  photo: string;
  isAddon: boolean;
  pricingMode: PricingMode;
  priceEach: number | null;
  variantSelections: Record<string, string>;
  qty: number;
  note: string;
  complimentaryItems?: ComplimentaryCartItem[];
}

export interface OrderRecord {
  id: string;
  items: CartItem[];
  customer: { name: string; phone: string; email: string };
  channel: 'whatsapp' | 'telegram' | 'sms';
  note: string;
  estimatedTotal: number | null;
  status: 'new' | 'contacted' | 'closed';
  userId: string | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: 'guest' | 'account';
  lastChannel?: string;
  orderCount: number;
  createdAt: string;
}

export interface User {
  id: string;
  identifier: string;
  name: string;
  role: 'customer' | 'admin';
}

export interface BusinessSettings {
  id?: string;
  key: 'business';
  phone: string;
  email: string;
  address: string;
  hours: string;
  whatsappNumber: string; // digits with country code, e.g. 251929639939
  telegramHandle: string; // @username or +2519… phone
  paymentAccountName: string;
  paymentAccountNumber: string;
  pickupLocation: string;
}
