import {
  AfterViewInit,
  Component,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  filter,
  take,
  combineLatest,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { MovesAuthService } from '../../services/moves-auth.service';
import { LoggerService } from '../../services/logger.service';
import { Nomenclature } from '../../models/nomenclature.model';
import { MovesNomenclatureService } from '../../services/moves-nomenclature.service';
import { RoutePerfService } from '../../services/route-perf.service';
import { MovesSettingsService } from '../../services/moves-settings.service';
import { SoundService } from '../../services/sound.service';

/**
 * Near-verbatim port of core/top-dog/top-dog.component.ts - task.component.ts
 * is the one live component in this app that extends it. Trimmed only by
 * dropping the `diagnosticComponent` ViewChild/`toggleDiagnosticInChild()`
 * pair and the SayIt-mode branch: the original template
 * (top-dog.component.html) is empty and never rendered DiagnosticComponent
 * in the first place (dead ViewChild), and no route in this app is a SayIt
 * route, so `isSayItContext()`'s branches are unreachable dead weight here.
 * Everything else - the ready$/pageReady$ gating, tenant/user/nomenclature
 * resolution, RoutePerfService integration - is unchanged.
 */
@Component( {
  selector: 'app-top-dog',
  imports: [],
  template: '',
} )
export class TopDogComponent implements OnInit, OnDestroy, AfterViewInit {
  topMenu = environment.topMenu;

  isLoading = false;

  nomenclature$: Observable<Nomenclature>;
  nomenclatureSubscription!: Subscription;
  nomenclature!: Nomenclature;
  readySubscription!: Subscription;

  readonly COMPANY_NAME = environment.COMPANY_NAME;

  version: string = environment.VERSION;

  userId!: string;

  tenantId!: any;

  isLoggedIn: boolean = false;

  isMobile: boolean = false;

  firebaseUser!: any;

  restrictedUser: boolean = true;

  private userIdSubscription!: Subscription;
  private tenantIdSubscription!: Subscription;
  private loggedInSubscription!: Subscription;
  private firebaseUserSubscription!: Subscription;

  private perf = inject( RoutePerfService );
  protected zone = inject( NgZone );

  private readySubject = new BehaviorSubject<boolean>( false );
  public ready$ = this.readySubject.asObservable();

  private pageReadySubject = new BehaviorSubject<boolean>( false );
  public pageReady$ = this.pageReadySubject.asObservable();

  constructor (
    protected authService: MovesAuthService,
    protected settingsService: MovesSettingsService,
    protected soundService: SoundService,
    protected logger: LoggerService,
    protected router: Router,
    protected nomenclatureService: MovesNomenclatureService,
  ) {
    this.nomenclature$ = this.nomenclatureService.currentNomenclature$;
  }

  ngOnInit (): void {
    this.setFirebaseUser();
    this.setTenantId();
    this.setUserId();
    this.setLoggedIn();
    this.setNomenclature();

    this.isMobile = window.innerWidth < 768;
  }

  ngOnDestroy (): void {
    if ( this.userIdSubscription ) this.userIdSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
    if ( this.loggedInSubscription ) this.loggedInSubscription.unsubscribe();
    if ( this.firebaseUserSubscription )
      this.firebaseUserSubscription.unsubscribe();
    if ( this.readySubscription ) this.readySubscription.unsubscribe();
  }

  ngAfterViewInit (): void {
    if ( this.shouldScrollPageToTopOnInit() ) {
      window.scrollTo( 0, 0 );
    }
    this.isLoading = false;

    this.readySubscription = combineLatest( [
      this.ready$.pipe( filter( Boolean ) ),
      this.pageReady$.pipe( filter( Boolean ) ),
    ] )
      .pipe( take( 1 ) )
      .subscribe( () => {
        this.zone.runOutsideAngular( () =>
          requestAnimationFrame( () =>
            this.perf.markRendered( { page: 'TopDog' } )
          )
        );
      } );
  }

  /** Embedded components can opt out of moving the host page on init. */
  protected shouldScrollPageToTopOnInit (): boolean {
    return true;
  }

  /**
   * Signal from child components that page content (data + DOM) is ready to measure.
   */
  public signalContentReady (): void {
    this.pageReadySubject.next( true );
  }

  setTenantId () {
    if ( !this.tenantId ) {
      this.tenantIdSubscription = this.authService
        .getTenantId()
        .subscribe( ( tenantId ) => {
          const masterTenantId =
            ( environment as any )?.taliferroTenantId || 'yH3nWanUv0RqDCNfwXBOXLWuxt52';

          this.tenantId = tenantId || masterTenantId;
          this.logger.info( 'TENANT ID', this.tenantId );
          this.checkIfReady();
        } );
    }
  }

  setUserId () {
    if ( !this.userId ) {
      this.userIdSubscription = this.authService
        .getUserId()
        .subscribe( ( userId ) => {
          this.userId = userId || environment.taliferroTenantId;
          this.logger.info( 'USER ID', this.userId );
          this.checkIfReady();
        } );
    }
  }

  setLoggedIn () {
    this.loggedInSubscription = this.authService
      .isLoggedIn()
      .subscribe( ( isLoggedIn ) => {
        this.isLoggedIn = isLoggedIn;
      } );

  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }

  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  setFirebaseUser (): void {
    if ( !this.firebaseUser ) {
      this.firebaseUserSubscription = this.authService
        .getUser()
        .subscribe( ( user ) => {
          this.firebaseUser = user;
          this.checkIfReady();
          this.checkUserMore();
        } );
    } else {
      this.checkUserMore();
    }
  }

  setNomenclature () {
    if ( !this.nomenclature ) {
      this.nomenclatureSubscription = this.nomenclature$.subscribe(
        ( settings ) => {
          this.nomenclature = settings;
          this.checkIfReady();
        }
      );
    }
  }

  private checkIfReady () {
    const hasNomenclature = this.nomenclature != undefined;

    if (
      this.firebaseUser &&
      this.userId &&
      this.tenantId !== undefined &&
      hasNomenclature
    ) {
      this.readySubject.next( true );
    }
  }

  private allowedProjects = new Set<string>();

  private checkUserMore () {
    try {
      this.restrictedUser = false;
      this.allowedProjects.clear();

      const email = ( this.firebaseUser?.email ?? '' ).trim().toLowerCase();
      if ( !email ) {
        this.logger.warn( 'No firebaseUser.email yet → unrestricted' );
        return;
      }
    } catch ( err ) {
      this.logger.error( 'checkUserMore error', err );
      this.restrictedUser = false;
      this.allowedProjects.clear();
    }
  }

  // Gate checks wherever you need them
  canAccessProject ( projectId: string ): boolean {
    return !this.restrictedUser || this.allowedProjects.has( projectId );
  }
}
