import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const SITE_URL = 'https://moves.16ahead.com';

/**
 * Search and link-preview tags for the prerendered public pages (/, /help,
 * /pricing, /ios; /about uses the shared template's own). Runs during the
 * build's prerender too, so what search engines read is in the HTML.
 * Canonical URLs are kept by provideCanonicalUrl (shared/canonical-url.ts).
 */
@Injectable( { providedIn: 'root' } )
export class SeoService {
  private readonly title = inject( Title );
  private readonly meta = inject( Meta );
  private readonly document = inject( DOCUMENT );

  /** Title (when given), description, and the matching Open Graph / Twitter tags. */
  page ( { title, description }: { title?: string; description: string } ): void {
    if ( title ) this.title.setTitle( title );
    const shown = title || this.title.getTitle();
    this.meta.updateTag( { name: 'description', content: description } );
    this.meta.updateTag( { property: 'og:title', content: shown } );
    this.meta.updateTag( { property: 'og:description', content: description } );
    this.meta.updateTag( { name: 'twitter:title', content: shown } );
    this.meta.updateTag( { name: 'twitter:description', content: description } );
  }

  /** One JSON-LD block per id (replaced, never duplicated). */
  structuredData ( id: string, data: object ): void {
    const head = this.document.head;
    if ( !head ) return;
    let script = head.querySelector<HTMLScriptElement>( `script[type="application/ld+json"][data-seo="${ id }"]` );
    if ( !script ) {
      script = this.document.createElement( 'script' );
      script.type = 'application/ld+json';
      script.setAttribute( 'data-seo', id );
      head.appendChild( script );
    }
    script.textContent = JSON.stringify( data );
  }

  removeStructuredData ( id: string ): void {
    this.document.head?.querySelector( `script[type="application/ld+json"][data-seo="${ id }"]` )?.remove();
  }
}
