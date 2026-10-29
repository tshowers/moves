import { ProductPagesConfig } from '@taliferro/ui/platform/product-pages.model';

/** Moves' About page (the shared template; copy in taliferro-ui product-pages.model.ts). */
export const PRODUCT_PAGES_CONFIG: ProductPagesConfig = {
  key: 'moves',
  logo: 'assets/brand/products/svg/light/06-moves.svg',
  logoDark: 'assets/brand/products/svg/dark/06-moves.svg',
  logoFill: true,
  openRoute: '/app',
  // The floating Menu (app.component) shows on /about.
  ownMenu: false,
};
