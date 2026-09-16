import { MovesAuthService } from './moves-auth.service';

const PENDING_LOGIN_KEY = 'moves_hosted_login_pending';

describe( 'MovesAuthService', () => {
  let service: MovesAuthService;

  beforeEach( () => {
    service = new MovesAuthService();
    sessionStorage.removeItem( PENDING_LOGIN_KEY );
  } );

  afterEach( () => {
    sessionStorage.removeItem( PENDING_LOGIN_KEY );
  } );

  describe( 'signIn', () => {
    // navigateToHostedLogin() is a thin seam around
    // `window.location.href = ...` specifically so this can be spied on
    // instead - `href` isn't actually configurable in real Chrome, so
    // spyOnProperty can't stub it, and letting a real hand-off fire here
    // would navigate the Karma runner's iframe away for real.
    it( 'stashes returnUrl and a CSRF state token in sessionStorage before handing off to the hosted login', () => {
      spyOn( service as unknown as { navigateToHostedLogin: () => void }, 'navigateToHostedLogin' );

      service.signIn( '/move' );

      const raw = sessionStorage.getItem( PENDING_LOGIN_KEY );
      expect( raw ).toBeTruthy();
      const pending = JSON.parse( raw as string );
      expect( pending.returnUrl ).toBe( '/move' );
      expect( typeof pending.state ).toBe( 'string' );
      expect( pending.state.length ).toBeGreaterThan( 0 );
    } );

    it( 'sends the browser to the hosted login with a matching state param', () => {
      const navigateSpy = spyOn( service as unknown as { navigateToHostedLogin: ( url: string ) => void }, 'navigateToHostedLogin' );

      service.signIn( '/pricing' );

      const pending = JSON.parse( sessionStorage.getItem( PENDING_LOGIN_KEY ) as string );
      expect( navigateSpy ).toHaveBeenCalledWith(
        `https://todd.taliferro.tech/login?client=moves-web-local&state=${pending.state}`
      );
    } );
  } );

  describe( 'consumePendingLogin', () => {
    it( 'returns the stashed returnUrl when the state matches', () => {
      spyOn( service as unknown as { navigateToHostedLogin: () => void }, 'navigateToHostedLogin' );
      service.signIn( '/move' );
      const pending = JSON.parse( sessionStorage.getItem( PENDING_LOGIN_KEY ) as string );

      expect( service.consumePendingLogin( pending.state ) ).toEqual( { returnUrl: '/move' } );
    } );

    it( 'returns null and clears storage when the state does not match (CSRF guard)', () => {
      spyOn( service as unknown as { navigateToHostedLogin: () => void }, 'navigateToHostedLogin' );
      service.signIn( '/move' );

      expect( service.consumePendingLogin( 'forged-state' ) ).toBeNull();
      expect( sessionStorage.getItem( PENDING_LOGIN_KEY ) ).toBeNull();
    } );

    it( 'returns null when nothing is pending', () => {
      expect( service.consumePendingLogin( 'any-state' ) ).toBeNull();
    } );
  } );
} );
