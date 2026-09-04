import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MovesAuthService } from '../../services/moves-auth.service';
import { MovesEntitlementService } from '../../services/moves-entitlement.service';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { MovesDataService } from '../../services/moves-data.service';
import { MovesPurchaseFlowService } from '../../services/moves-purchase-flow.service';
import { MOVES_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { Product } from '../../models/product.model';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

const DEFAULT_PRICE = '$29/month';
const DEFAULT_HIGHLIGHTS = [
  'Create and manage more than your 10 free moves.',
  'Keep tasks, follow-up, and momentum in one place.',
  'Use Moves to keep work from stalling.'
];
const DEFAULT_NOTES = [
  'Free access includes up to 10 moves.',
  'The paid plan removes the free-move wall so you can keep building momentum.',
  'Moves is for keeping work active, visible, and moving.'
];

@Component( {
  selector: 'app-moves-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClickSoundDirective],
  templateUrl: './moves-pricing.component.html',
  styleUrl: './moves-pricing.component.css'
} )
export class MovesPricingComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly entitlements$ = inject( MovesEntitlementService ).getEntitlements();
  private readonly purchaseFlowConfig = MOVES_PURCHASE_FLOW;
  private authService = inject( MovesAuthService );
  private router = inject( Router );
  private dataService = inject( MovesDataService );

  tenantIdSubscription!: Subscription;
  userSubscription!: Subscription;
  private signalSubscription!: Subscription;
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';

  private tenantProduct: Product | null = null;

  email = '';
  tenantId = '';
  isStartingCheckout = false;
  checkoutError = '';
  requiresLogin = false;

  get monthlyPrice (): string {
    return this.tenantProduct?.priceLabel || DEFAULT_PRICE;
  }

  get highlights (): string[] {
    const d = this.tenantProduct?.shortDescription;
    return d ? [d] : DEFAULT_HIGHLIGHTS;
  }

  get notes (): string[] {
    const d = this.tenantProduct?.description;
    return d ? [d] : DEFAULT_NOTES;
  }

  constructor (
    private toddAssistantBusService: MovesAssistantSignalService,
    private purchaseFlowService: MovesPurchaseFlowService
  ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUser().subscribe( firebaseUser => {
      this.email = firebaseUser?.email || '';
      this.requiresLogin = !firebaseUser;
    } );

    this.tenantIdSubscription = this.authService.getTenantId().subscribe( async tenantId => {
      this.tenantId = tenantId || '';
      if ( this.tenantId ) {
        await this.loadTenantProduct( 'moves' );
      }
    } );

    this.signalSubscription = this.toddAssistantBusService.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  goToLogin (): void {
    void this.purchaseFlowService.goToLogin( this.router, this.purchaseFlowConfig );
  }

  private async loadTenantProduct ( productName: string ): Promise<void> {
    try {
      const contact = await this.dataService.getContactFullByIdOnce( this.tenantId, this.tenantId );
      const products: Product[] = ( contact as any )?.company?.products || [];
      this.tenantProduct = products.find(
        p => p.active !== false && p.discontinued !== true &&
             p.name?.toLowerCase().includes( productName )
      ) || null;
    } catch {
      this.tenantProduct = null;
    }
  }

  async startCheckout (): Promise<void> {
    this.checkoutError = '';
    this.requiresLogin = !this.email;

    if ( this.requiresLogin ) {
      this.checkoutError = 'Please sign in before purchasing Moves access.';
      return;
    }

    const tenantId = this.tenantId.trim();
    const email = this.email.trim().toLowerCase();

    if ( !tenantId ) {
      this.checkoutError = 'We could not find you. Please sign in again and try once more.';
      return;
    }

    if ( !email ) {
      this.checkoutError = 'Email is required before checkout.';
      return;
    }

    this.isStartingCheckout = true;

    try {
      const checkoutUrl = await this.purchaseFlowService.startCheckout(
        this.purchaseFlowConfig,
        Object.assign(
          { tenantId, email },
          this.tenantProduct?.stripePriceIdMonthly
            ? { priceId: this.tenantProduct.stripePriceIdMonthly }
            : {}
        ),
        'Unable to start Moves checkout.'
      );

      this.purchaseFlowService.redirectToCheckout( checkoutUrl );
    } catch ( error: any ) {
      this.checkoutError = error?.message || 'Unable to start Moves checkout.';
      this.isStartingCheckout = false;
    }
  }
}
