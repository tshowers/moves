import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Moves' part of the universal menu: what you can do in Moves. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'moves',
  name: 'Moves',
  logo: 'assets/find/entities/moves/logo.png',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Moves Home', icon: 'grid', route: '/app' },
    { label: 'Execution', icon: 'list', route: '/moves-view' },
    { label: 'New Move', icon: 'plus', route: '/move', keywords: 'create add' },
    { label: 'Mission', icon: 'target', route: '/plan', keywords: 'plan goals' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
