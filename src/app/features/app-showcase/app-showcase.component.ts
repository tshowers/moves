import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component( {
  selector: 'app-moves-ios-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-showcase.component.html',
  styleUrls: [ './app-showcase.component.css', './app-showcase.responsive.css' ]
} )
export class AppShowcaseComponent {
  readonly theme = inject(ThemeService);
  readonly highlights = [
    { heading: 'See what needs attention before it stalls', copy: 'Open Moves and get a clear read on the work that is aging, blocked, or ready for the next action.' },
    { heading: 'Create the next move in the moment', copy: 'Capture a follow-up while the conversation is fresh and connect it to the contact, deal, or campaign it serves.' },
    { heading: 'Keep momentum visible wherever you work', copy: 'Your move list stays connected to the same momentum signals TODD watches on the web.' }
  ];
}
