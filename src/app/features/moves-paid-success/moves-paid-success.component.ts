import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MovesAssistantSignalService } from '../../services/moves-assistant-signal.service';
import { MovesPurchaseFlowService } from '../../services/moves-purchase-flow.service';
import { MOVES_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

@Component( {
  selector: 'app-moves-paid-success',
  standalone: true,
  imports: [CommonModule, RouterLink, ClickSoundDirective],
  templateUrl: './moves-paid-success.component.html',
  styleUrl: './moves-paid-success.component.css'
} )
export class MovesPaidSuccessComponent implements OnInit, OnDestroy {
  private readonly purchaseFlowConfig = MOVES_PURCHASE_FLOW;
  private route = inject( ActivatedRoute );
  private router = inject( Router );
  private signalSubscription!: Subscription;
  toddSignalState: 'idle' | 'listening' | 'thinking' | 'ready' = 'idle';

  isConfirming = true;
  isSuccess = false;
  errorMessage = '';

  constructor (
    private toddAssistantBusService: MovesAssistantSignalService,
    private purchaseFlowService: MovesPurchaseFlowService
  ) { }


  async ngOnInit (): Promise<void> {
    this.signalSubscription = this.toddAssistantBusService.signalState$
      .subscribe( state => {
        this.toddSignalState = state;
      } );

    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();

    if ( !sessionId ) {
      this.isConfirming = false;
      this.errorMessage = 'Missing session information. Please try again.';
      return;
    }

    try {
      await this.purchaseFlowService.confirmCheckout( this.purchaseFlowConfig, sessionId );
      this.isSuccess = true;
    } catch ( err: any ) {
      this.errorMessage = err?.message || 'Something went wrong confirming your purchase.';
    } finally {
      this.isConfirming = false;
    }
  }

  goToMoves (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }

  ngOnDestroy (): void {
    if ( this.signalSubscription ) this.signalSubscription.unsubscribe();
  }

}
