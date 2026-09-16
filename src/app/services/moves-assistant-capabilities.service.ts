import { Injectable } from '@angular/core';

export type LocalCapability = {
  id: string;
  label: string;
  hint?: string;
  patterns: string[];
  guard?: () => boolean;
};

export type DirectNavResult =
  | { handled: false; }
  | { handled: true; kind: 'message'; message: string; }
  | { handled: true; kind: 'navigate'; path: string; };

type WorkflowGuide = {
  id: string;
  patterns: RegExp[];
  message: string;
};

export type CapabilityContext = {
  placeholderChoices: string[];
};

/**
 * Moves' own slice of TODD's AssistantCapabilitiesService - same scoping
 * decision as web-products/network and web-products/pulse's capabilities
 * services. Only Moves' own routes and the create-move workflow guide
 * (adapted from TODD's original '/task-edit' + '/moves/app' + '/mission'
 * paths to this app's own '/move' + '/app' + '/plan').
 */
@Injectable( { providedIn: 'root' } )
export class MovesAssistantCapabilitiesService {
  private readonly directRouteAliases: Record<string, string> = {
    'moves': 'app',
    'my moves': 'app',
    'execution': 'app',
    'create move': 'move',
    'new move': 'move',
    'add move': 'move',
    'moves browser': 'moves-view',
    'browse moves': 'moves-view',
    'ai missions': 'ai-missions',
    'mission workspace': 'plan',
    'plan': 'plan',
    'pricing': 'pricing',
    'home': '',
  };

  private readonly directCommandRoutes: { path: string; requiresId?: boolean; idParam?: string; }[] = [
    { path: '' },
    { path: 'app' },
    { path: 'login' },
    { path: 'pricing' },
    { path: 'moves-view' },
    { path: 'move' },
    { path: 'move/:id', requiresId: true, idParam: 'id' },
    { path: 'ai-missions' },
    { path: 'plan' },
  ];

  private readonly workflowGuides: WorkflowGuide[] = [
    {
      id: 'create-move',
      patterns: [
        /\bhow do i create (a )?(move|task)\b/i,
        /\bhow to create (a )?(move|task)\b/i,
      ],
      message: [
        '<p><strong>To create a Move, you have two good options.</strong></p>',
        '<p><strong>A.</strong> Open <strong>/move</strong> for a direct new Move.</p>',
        '<p><strong>B.</strong> Open the Execution cockpit at <strong>/app</strong> if you want TODD to help you place that work in context.</p>',
        '<p>If the work belongs to a larger outcome, use Mission Workspace at <strong>/plan</strong>.</p>'
      ].join( '' )
    },
  ];

  private normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )
      .replace( /[^a-z0-9\s]/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  private stripLeadingVerb ( text: string ): string {
    const verbs = ['show', 'open', 'go', 'goto', 'navigate', 'add', 'take', 'create'];
    const fillers = new Set( ['me', 'to', 'the', 'a', 'an', 'page'] );
    const parts = ( text || '' ).trim().toLowerCase().split( /\s+/ );
    if ( !parts.length ) return '';

    let idx = 0;
    if ( verbs.includes( parts[0] ) ) {
      idx = 1;
      while ( idx < parts.length && fillers.has( parts[idx] ) ) idx++;
    }
    return parts.slice( idx ).join( ' ' );
  }

  public tryDirectNavCommand ( prompt: string ): DirectNavResult {
    const raw = ( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const withoutVerb = this.stripLeadingVerb( raw );
    if ( !withoutVerb ) return { handled: false };

    const normalizedInput = this.normalizeCommand( withoutVerb );
    const rawLower = raw.toLowerCase();
    const aliasedPath = this.directRouteAliases[normalizedInput];

    if ( aliasedPath !== undefined ) {
      return { handled: true, kind: 'navigate', path: '/' + aliasedPath };
    }

    for ( const route of this.directCommandRoutes ) {
      const normalizedRoute = this.normalizeCommand( route.path );

      if ( route.requiresId ) {
        if ( normalizedInput === normalizedRoute ) {
          const baseLabel = normalizedRoute;
          return {
            handled: true,
            kind: 'message',
            message: `To open a ${baseLabel}, type "${baseLabel} YOUR_ID" (for example: "${baseLabel} 12345").`
          };
        }

        if ( normalizedInput.startsWith( normalizedRoute + ' ' ) ) {
          const idPart = normalizedInput.slice( normalizedRoute.length + 1 ).trim();
          if ( !idPart ) continue;
          const navPath = route.path.replace( /:([^\/]+)/, idPart );
          return { handled: true, kind: 'navigate', path: '/' + navPath };
        }

        continue;
      }

      if ( normalizedInput === normalizedRoute || rawLower === route.path.toLowerCase() ) {
        return { handled: true, kind: 'navigate', path: '/' + route.path };
      }
    }

    return { handled: false };
  }

  public tryWorkflowGuide ( prompt: string ): DirectNavResult {
    const raw = String( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const guide = this.workflowGuides.find( item => item.patterns.some( pattern => pattern.test( raw ) ) );
    if ( !guide ) return { handled: false };

    return { handled: true, kind: 'message', message: guide.message };
  }

  private getNavCommandCapabilities (): LocalCapability[] {
    return this.directCommandRoutes
      .filter( c => !c.requiresId && c.path )
      .map( c => {
        const label = this.normalizeCommand( c.path );
        return {
          id: `nav-${c.path}`,
          label,
          hint: `Go to ${label}`,
          patterns: [label, c.path.toLowerCase()],
          guard: () => true
        };
      } );
  }

  public getLocalCapabilities ( ctx: CapabilityContext ): LocalCapability[] {
    const base: LocalCapability[] = [
      {
        id: 'create-move',
        label: 'Create a Move',
        hint: 'New task from a description',
        patterns: ['create move', 'new move', 'add move'],
        guard: () => true
      },
      {
        id: 'browse-moves',
        label: 'Browse Moves',
        hint: 'Filter, sort, and open moves',
        patterns: ['moves browser', 'browse moves', 'moves view'],
        guard: () => true
      },
      {
        id: 'help',
        label: 'How this works',
        hint: 'Open Assistant Box help',
        patterns: ['help', 'how it works', 'what can you do'],
        guard: () => true
      }
    ];

    return [...base, ...this.getNavCommandCapabilities()];
  }

  public scoreLocalSuggestions ( query: string, ctx: CapabilityContext ): string[] {
    const caps = this.getLocalCapabilities( ctx );
    const q = ( query || '' ).trim().toLowerCase();
    if ( !q ) return [];

    const terms = q.split( /\s+/ );
    const termScore = ( text: string, weight = 1 ) => terms.reduce( ( s, t ) => ( text.includes( t ) ? s + weight : s ), 0 );

    const ranked = caps
      .map( c => {
        const label = c.label.toLowerCase();
        const hint = ( c.hint || '' ).toLowerCase();
        const patterns = c.patterns.join( ' ' ).toLowerCase();
        const score = termScore( label, 3 ) + termScore( patterns, 2 ) + termScore( hint, 1 );
        return { c, score };
      } )
      .filter( x => x.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( x => x.c.label );

    if ( !ranked.length ) {
      return ( ctx.placeholderChoices || [] ).filter( p => p.toLowerCase().includes( q ) ).slice( 0, 8 );
    }

    return Array.from( new Set( ranked ) ).slice( 0, 8 );
  }
}
