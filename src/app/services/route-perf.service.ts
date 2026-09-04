import { Injectable } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { LoggerService } from './logger.service';

/**
 * Near-verbatim port of services/route-perf.service.ts - self-contained
 * (Router + LoggerService only), so ported unchanged. TopDogComponent
 * (which task.component.ts extends) calls markRendered() once its
 * readiness + page-content-ready observables both fire.
 */
@Injectable( {
  providedIn: 'root'
} )
export class RoutePerfService {
  private navId = 0;
  private currentRouteKey: string | null = null;
  private lcpEntry: PerformanceEntry | null = null;
  private lcpObserver?: PerformanceObserver;

  constructor ( private router: Router, private logger: LoggerService ) {
    this.router.events.subscribe( e => {
      if ( e instanceof NavigationStart ) {
        this.navId++;
        this.currentRouteKey = `${this.navId}:${e.url}`;
        performance.mark( `nav-start:${this.currentRouteKey}` );
        this.startLcpObserver();
      }
      if ( e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError ) {
        // We DON'T stop here—this is just the router. We'll stop when component says it's rendered.
      }
    } );
  }

  markRendered ( extra?: Record<string, any> ) {
    if ( !this.currentRouteKey ) return;
    const key = this.currentRouteKey;
    const startMark = `nav-start:${key}`;
    const endMark = `render-done:${key}`;
    const measureName = `route-total:${key}`;

    if ( performance.getEntriesByName( startMark ).length === 0 ) {
      this.logger.warn( '[RoutePerf] missing start mark; creating synthetic start', { key } );
      performance.mark( startMark );
    }

    performance.mark( endMark );

    let totalMs = 0;

    try {
      performance.measure( measureName, startMark, endMark );
      const measure = performance.getEntriesByName( measureName ).pop();
      totalMs = measure?.duration ?? 0;
    } catch ( err ) {
      const s = performance.getEntriesByName( startMark ).pop();
      const e = performance.getEntriesByName( endMark ).pop();
      if ( s && e ) {
        totalMs = Math.max( 0, ( e.startTime as number ) - ( s.startTime as number ) );
      }
      this.logger.warn( '[RoutePerf] measure fallback due to missing marks', { key, err } );
    }

    const fcp = performance.getEntriesByName( 'first-contentful-paint' ).pop() as PerformanceEntry | undefined;
    const lcp = this.lcpEntry;

    let color = 'color: gray';
    if ( totalMs < 2000 ) {
      color = 'color: green';
    } else if ( totalMs < 5000 ) {
      color = 'color: orange';
    } else if ( totalMs >= 5000 ) {
      color = 'color: red';
    }

    this.logger.log(
      `%c[RoutePerf] route=${key} total=${totalMs.toFixed( 0 )}ms fcp=${fcp?.startTime?.toFixed( 0 )} lcp=${lcp?.startTime?.toFixed( 0 )}`,
      color,
      extra || ''
    );

    this.stopLcpObserver();
    performance.clearMarks( startMark );
    performance.clearMarks( endMark );
    performance.clearMeasures( measureName );
  }

  private startLcpObserver () {
    this.stopLcpObserver();
    if ( 'PerformanceObserver' in window ) {
      this.lcpObserver = new PerformanceObserver( ( list ) => {
        const entries = list.getEntries();
        this.lcpEntry = entries[entries.length - 1] ?? null;
      } );
      try {
        this.lcpObserver.observe( { type: 'largest-contentful-paint', buffered: true as any } );
      } catch { /* older browsers */ }
    }
  }

  private stopLcpObserver () {
    this.lcpObserver?.disconnect();
    this.lcpObserver = undefined;
    this.lcpEntry = null;
  }
}
