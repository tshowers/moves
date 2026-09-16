import { Injectable } from '@angular/core';

/**
 * Trimmed port of TODD's AssistantIntentRunnerService. Same trim as
 * web-products/network and web-products/pulse's ports - this app only ever
 * has one domain, so there's nothing to route between.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantIntentRunnerService {
    /** Only one domain exists here, so this only ever confirms it applies. */
    routeDomain ( prompt: string ): 'task' | null {
        const p = ( prompt || '' ).trim();
        if ( !p ) return null;
        const lower = p.toLowerCase();

        if ( /(move|moves|task|tasks|todo|to-do|due|deadline|assign|project|mission)/.test( lower ) ) return 'task';

        return null;
    }
}
