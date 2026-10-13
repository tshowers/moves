import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Moves' part of the universal menu: what you can do in Moves. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'moves',
  name: 'Moves',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Momentum', icon: 'grid', route: '/app', keywords: 'projects lines today' },
    { label: 'Team', icon: 'list', route: '/app/team', keywords: 'people capacity load' },
    { label: 'Weekly review', icon: 'target', route: '/app/review', keywords: 'standup decide' },
    { label: 'New project', icon: 'plus', route: '/app/new', keywords: 'create add plan paste' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
