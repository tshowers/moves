import { flowPageContext } from './flow-assistant-context';
import { demoState } from './flow-demo.data';
import { computeIssues } from './flow-engine';

/** What TODD's assistant is told about the flow-map screen you're on. */
describe( 'flowPageContext', () => {
  const state = demoState();
  const base = { state, issues: computeIssues( state ), autonomy: { mode: 'on' as const }, isSample: true };

  it( 'describes Momentum with what needs the lead', () => {
    const ctx = flowPageContext( { ...base, url: '/app' } );
    expect( ctx ).toEqual( jasmine.objectContaining( { feature: 'moves', page: 'momentum', mode: 'sample' } ) );
    expect( ctx.summary!['needsYouCount'] ).toBeGreaterThan( 0 );
    expect( ( ctx.dataPreview!['projects'] as { name: string }[] ).map( p => p.name ) ).toContain( 'Harbor app launch' );
    expect( ctx.description ).toContain( 'sample team' );
  } );

  it( 'names the project and tab, ignoring the #anchor', () => {
    const ctx = flowPageContext( { ...base, url: '/app/projects/brand/sequence#top' } );
    expect( ctx.page ).toBe( 'project' );
    expect( ctx.summary!['project'] ).toBe( 'Brand refresh' );
    expect( ctx.summary!['tab'] ).toBe( 'sequence' );
  } );

  it( 'puts the move open in the drawer first', () => {
    const ctx = flowPageContext( { ...base, url: '/app/projects/acme?move=a2' } );
    expect( ctx.selectedEntityType ).toBe( 'move' );
    expect( ctx.selectedEntityId ).toBe( 'a2' );
    expect( ( ctx.dataPreview!['move'] as { title: string; owner: string } ) ).toEqual( jasmine.objectContaining( { title: 'Price the Acme add-ons', owner: 'Luis Mora' } ) );
  } );
} );
