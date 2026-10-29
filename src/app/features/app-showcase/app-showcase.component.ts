import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';

@Component( {
  selector: 'app-moves-ios-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-showcase.component.html',
  styleUrls: [ './app-showcase.component.css', './app-showcase.responsive.css' ]
} )
export class AppShowcaseComponent {
  /** Prerendered for search engines (app.routes.server.ts). Same title as the route's. */
  private readonly seo = inject( SeoService ).page( {
    title: 'Moves for iPhone | 16Ahead',
    description: 'Moves for iPhone: your next moves, hand-offs from 16Ahead with Done and Can’t do it right on the notification, and the same account as the web.',
  } );

  readonly highlights = [
    { heading: 'See what needs attention before it stalls', copy: 'Open Moves and get a clear read on the work that is aging, blocked, or ready for the next action.' },
    { heading: 'Create the next move in the moment', copy: 'Capture a follow-up while the conversation is fresh and connect it to the contact, deal, or campaign it serves.' },
    { heading: 'Keep momentum visible wherever you work', copy: 'Your move list stays connected to the same momentum signals 16Ahead watches on the web.' }
  ];
}
