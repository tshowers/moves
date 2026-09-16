import packageJson from '../../package.json';

export const environment = {
  production: true,
  COMPANY_NAME: 'Moves',
  PLATFORM_URL: 'https://moves.taliferro.tech',
  backendURL: 'https://api.taliferro.tech/api',
  apiKey: 'AIzaSyCAAgRd8tq9PXkPKE2zddseYtZ-Xx_P8mU',
  VERSION: String(packageJson.version || ''),
  topMenu: true,
  multiTenant: true,
  taliferroTenantId: 'yH3nWanUv0RqDCNfwXBOXLWuxt52',
  firebaseConfig: {
    apiKey: 'AIzaSyApZSnHn8Pd2fI_0oSod0Sv9O_JsOoniBc',
    authDomain: 'taliferrotech.firebaseapp.com',
    projectId: 'taliferrotech',
    storageBucket: 'taliferrotech.appspot.com',
    messagingSenderId: '633736143723',
    appId: '1:633736143723:web:1f91a0cc7efcdc9b5fe22e',
    measurementId: 'G-YQ9PHPM6FJ',
  },
};
