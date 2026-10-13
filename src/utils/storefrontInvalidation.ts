const EVENT_NAME = 'defra:storefront-invalidated';
const CHANNEL_NAME = 'defra-storefront-data';

export function invalidateStorefrontData() {
  window.dispatchEvent(new Event(EVENT_NAME));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'INVALIDATE' });
    channel.close();
  }
}

export function subscribeStorefrontInvalidation(refresh: () => void) {
  const localHandler = () => refresh();
  window.addEventListener(EVENT_NAME, localHandler);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  if (channel) channel.onmessage = (event) => {
    if (event.data?.type === 'INVALIDATE') refresh();
  };
  return () => {
    window.removeEventListener(EVENT_NAME, localHandler);
    channel?.close();
  };
}
