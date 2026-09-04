import { Injectable } from '@angular/core';

export type ToddTipCategory = 'general' | 'tasks';

export interface ToddTip {
  id: string;
  text: string;
  category: ToddTipCategory;
  page?: string;
}

/**
 * Trimmed from services/tip.service.ts (422 lines covering every TODD
 * module's tip pool) - only the 'tasks'/'general' entries survive here,
 * since task.component.ts's `taskTipText` is the only caller in scope
 * (`this.tipService.getRandomTipText('tasks', 'tasks')`). Same
 * pool-with-general-fallback and no-immediate-repeat selection logic as
 * the original getRandomTip/pickRandom.
 */
@Injectable( {
  providedIn: 'root'
} )
export class MovesTipService {
  private lastTipId: string | null = null;

  private readonly tips: ToddTip[] = [
    {
      id: 'general-1',
      text: 'Small, consistent moves beat big, random pushes. Add one move you can finish today.',
      category: 'general',
    },
    {
      id: 'general-2',
      text: 'Use notes on contacts to capture context you will forget in 48 hours.',
      category: 'general',
    },
    {
      id: 'general-3',
      text: 'If everything is important, nothing is. Tag the top three moves that really matter.',
      category: 'general',
    },
    {
      id: 'tasks-1',
      text: 'Archive old moves that are no longer relevant. A clean board makes TODD feel lighter.',
      category: 'tasks',
    },
    {
      id: 'tasks-2',
      text: 'If a move has been stuck for weeks, break it into two smaller ones.',
      category: 'tasks',
    },
    {
      id: 'tasks-3',
      text: 'Use due dates only for things that truly have a date. Everything else can stay unscheduled.',
      category: 'tasks',
    },
    {
      id: 'tasks-4',
      text: 'Tie moves to specific contacts, not just projects. Revenue comes from people, not boards.',
      category: 'tasks',
    },
    {
      id: 'tasks-5',
      text: 'When you finish a move, set the next one immediately. Momentum dies in the gap between "done" and "what now?".',
      category: 'tasks',
    },
    {
      id: 'tasks-6',
      text: 'If TODD keeps showing the same name in your suggestions, it’s a signal. Either move them forward—or archive.',
      category: 'tasks',
    },
  ];

  getRandomTipText ( category?: ToddTipCategory, page?: string ): string {
    return this.getRandomTip( category, page )?.text ?? '';
  }

  getRandomTip ( category?: ToddTipCategory, page?: string ): ToddTip {
    const pool = this.getTipPool( category, page );
    if ( pool.length === 0 ) {
      const generalPool = this.getTipPool( 'general' );
      if ( generalPool.length === 0 ) {
        return { id: 'fallback', text: 'No tips yet.', category: 'general' };
      }
      return this.pickRandom( generalPool );
    }
    return this.pickRandom( pool );
  }

  private getTipPool ( category?: ToddTipCategory, page?: string ): ToddTip[] {
    let pool = this.tips;

    if ( category ) {
      pool = pool.filter( t => t.category === category );
    }

    if ( page ) {
      const pageMatches = pool.filter( t => t.page === page );
      if ( pageMatches.length > 0 ) {
        pool = pageMatches;
      }
    }

    return pool;
  }

  private pickRandom ( pool: ToddTip[] ): ToddTip {
    if ( pool.length === 1 ) {
      this.lastTipId = pool[0].id;
      return pool[0];
    }

    let tip: ToddTip;
    let safety = 0;

    do {
      const index = Math.floor( Math.random() * pool.length );
      tip = pool[index];
      safety++;
    } while ( tip.id === this.lastTipId && safety < 5 );

    this.lastTipId = tip.id;
    return tip;
  }
}
