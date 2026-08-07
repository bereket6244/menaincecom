import { apiSend } from './api';
import type { BusinessSettings, CartItem, OrderRecord, User } from './types';
import { buildCartOrderMessage, buildOrderMessage } from './share';

export type OrderChannel = 'whatsapp' | 'telegram' | 'sms';

export interface PlacedOrder {
  /** The text the customer forwards to the studio. */
  message: string;
  /** The recorded order, or null when the API could not be reached. */
  order: OrderRecord | null;
}

/** Signed-in customers order under their account; guests send anonymously. */
function customerFor(user: User | null) {
  if (!user) return { name: '', phone: '', email: '' };
  const isEmail = user.identifier.includes('@');
  return {
    name: user.name,
    phone: isEmail ? '' : user.identifier,
    email: isEmail ? user.identifier : '',
  };
}

/**
 * Records the order with the API, then builds the chat message from the
 * *server's* copy so the prices the customer forwards are the catalog's, not
 * whatever was cached in the browser.
 *
 * If the API cannot be reached the order still goes out — a customer standing
 * in front of a broken server should not be blocked from messaging the studio.
 * In that case `order` is null and the caller warns that nothing was recorded.
 */
export async function placeOrder({
  items, channel, note, user, business, origin,
}: {
  items: CartItem[];
  channel: OrderChannel;
  note: string;
  user: User | null;
  business: BusinessSettings | null;
  origin: string;
}): Promise<PlacedOrder> {
  try {
    const response = await apiSend<{ order: OrderRecord }>('POST', '/orders', {
      channel,
      note,
      customer: customerFor(user),
      items: items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        note: item.note,
        variantSelections: item.variantSelections,
        complimentaryItems: (item.complimentaryItems || []).map((freeItem) => ({
          name: freeItem.name,
          qty: freeItem.qty,
        })),
      })),
    });
    return { message: buildOrderMessage(response.order, business, origin), order: response.order };
  } catch {
    return { message: buildCartOrderMessage(items, note, origin), order: null };
  }
}
