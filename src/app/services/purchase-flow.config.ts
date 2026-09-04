/**
 * Trimmed from services/purchase-flow.config.ts via Network's own trimmed
 * copy - only the Moves entry, and postConfirmRoute/loginReturnUrl point
 * at this app's own root-level routes ('/app', '/pricing') rather than
 * TODD's '/moves' sub-route, since this app IS Moves, not a page inside a
 * larger app. checkoutEndpoint/confirmEndpoint stay '/moves/checkout'
 * and '/moves/checkout/confirm' unchanged - those are backend route
 * paths, not frontend routes, and the backend is untouched by this
 * extraction.
 */
export interface ProductPurchaseFlowConfig {
  productKey: 'moves';
  loginReturnUrl: string;
  checkoutEndpoint: string;
  confirmEndpoint: string;
  successRoute: string;
  postConfirmRoute: string;
  checkoutUrlField?: string;
  checkoutCredentials?: RequestCredentials;
  confirmCredentials?: RequestCredentials;
  legacyAccessStorageKey?: string;
}

export const MOVES_PURCHASE_FLOW: ProductPurchaseFlowConfig = {
  productKey: 'moves',
  loginReturnUrl: '/pricing',
  checkoutEndpoint: '/moves/checkout',
  confirmEndpoint: '/moves/checkout/confirm',
  successRoute: '/success',
  postConfirmRoute: '/app',
};
