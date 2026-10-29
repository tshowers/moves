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
 * services. Only Moves' own routes (the flow map under /app) and a few
 * workflow guides.
 */
@Injectable( { providedIn: 'root' } )
export class MovesAssistantCapabilitiesService {
  private readonly directRouteAliases: Record<string, string> = {
    'moves': 'app',
    'momentum': 'app',
    'board': 'app',
    'projects': 'app',
    'team': 'app/team',
    'people': 'app/team',
    'capacity': 'app/team',
    'review': 'app/review',
    'weekly review': 'app/review',
    'standup': 'app/review',
    'todd': 'app/todd',
    'log': 'app/todd',
    'rules': 'app/todd',
    'todd rules': 'app/todd',
    'new project': 'app/new',
    'create project': 'app/new',
    'paste a plan': 'app/new',
    'new move': 'app/new',
    'create move': 'app/new',
    'digest': 'app/digest',
    'morning digest': 'app/digest',
    'my moves': 'app/me',
    'my next moves': 'app/me',
    'help': 'help',
    'pricing': 'pricing',
    'home': '',
  };

  private readonly directCommandRoutes: { path: string; requiresId?: boolean; idParam?: string; }[] = [
    { path: '' },
    { path: 'app' },
    { path: 'app/team' },
    { path: 'app/review' },
    { path: 'app/todd' },
    { path: 'app/new' },
    { path: 'app/digest' },
    { path: 'app/me' },
    { path: 'help' },
    { path: 'login' },
    { path: 'pricing' },
  ];

  private readonly workflowGuides: WorkflowGuide[] = [
    {
      id: 'create-project',
      patterns: [
        /\bhow (do i|to) (create|start|add|make) (a )?(new )?(project|move|task|plan)\b/i,
      ],
      message: [
        '<p><strong>Start from the plan you already have.</strong></p>',
        '<p>Open <strong>/app/new</strong> and paste a list, a doc or meeting notes - one move per line, owners in brackets like “(Sam)”.</p>',
        '<p>16Ahead draws it as a line and checks it first: anything in the wrong order, without an owner (The Marketing Assistant can take content work), or without a next action. Fix what you like, then create it.</p>',
      ].join( '' )
    },
    {
      id: 'fix-break',
      patterns: [
        /\bwhat (needs|does .* need) (me|my attention)\b/i,
        /\bhow (do i|to) (fix|clear) (a |the )?(break|gap|stall)s?\b/i,
      ],
      message: [
        '<p><strong>Everything that needs you is in one place.</strong></p>',
        '<p>Run the weekly review at <strong>/app/review</strong>: one decision at a time, 16Ahead’s suggestion first, keys 1–4 to choose.</p>',
        '<p>Or fix it where you see it - the note in Momentum’s margin, or Diagnosis on the project.</p>',
      ].join( '' )
    },
    {
      id: 'todd-on-its-own',
      patterns: [
        /\bwhat (does|can) todd do\b/i,
        /\b(turn|switch) (todd )?(on|off)\b/i,
        /\bpractic(e|ing)\b/i,
      ],
      message: [
        '<p><strong>16Ahead acts within rules you set</strong> - hand off what the Marketing Assistant and it can’t do, nudge after four quiet days, reschedule within slack, split the Marketing Assistant’s part off a move.</p>',
        '<p>Its first week is practice: it logs what it would do and changes nothing. Turn it on, pause it, or switch rules off at <strong>/app/todd</strong>. Everything it does has Undo.</p>',
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
        id: 'new-project',
        label: 'New project',
        hint: 'Paste a plan; 16Ahead checks it',
        patterns: ['new project', 'create project', 'paste a plan', 'new move'],
        guard: () => true
      },
      {
        id: 'review',
        label: 'Weekly review',
        hint: 'Decide what needs you',
        patterns: ['review', 'standup', 'what needs me'],
        guard: () => true
      },
      {
        id: 'team',
        label: 'Team',
        hint: 'Who has room',
        patterns: ['team', 'capacity', 'who has room'],
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
