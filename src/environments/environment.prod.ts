export const environment = {
  production: true,
  COMPANY_NAME: 'Moves',
  PLATFORM_URL: 'https://moves.taliferro.tech',
  backendURL: 'https://api.taliferro.tech/api',
  apiKey: 'AIzaSyCAAgRd8tq9PXkPKE2zddseYtZ-Xx_P8mU',
  // Static build version - the monorepo pulls this from package.json via
  // require(), which the newer esbuild application builder used here
  // (same builder Network/Pulse/Lead-Vault use) doesn't support the same
  // way. TopDogComponent only surfaces this for display, so a static
  // string is a safe simplification rather than wiring up a JSON import.
  VERSION: '1.0.0',
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
