import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

interface Faq { question: string; answer: string; }

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  readonly menuOpen = signal(false);
  readonly openFaq = signal<number | null>(0);

  readonly features = [
    { number: '01', title: 'Momentum, made visible.', copy: 'Moves notices when work is aging, drifting, or waiting on someone. The signal arrives before the excuse.', accent: 'blue' },
    { number: '02', title: 'Context stays attached.', copy: 'Every next move keeps the person, deal, campaign, or deliverable it serves. No more archaeological follow-up.', accent: 'orange' },
    { number: '03', title: 'A board with a pulse.', copy: 'See what is active, what is stuck, and what deserves the next hour—all without another status meeting.', accent: 'green' }
  ];

  readonly faqs: Faq[] = [
    { question: 'What makes a move different from a task?', answer: 'A move is tied to the work it serves and watched for momentum, so TODD can surface when a next action is aging or at risk.' },
    { question: 'Can Moves connect to contacts and campaigns?', answer: 'Yes. Moves keeps the contact, deal, or campaign behind the work attached to the next action.' },
    { question: 'Who is Moves for?', answer: 'Anyone managing follow-up, deliverables, or shared work who wants to know what needs action next.' }
  ];

  toggleMenu(): void { this.menuOpen.update(open => !open); }
  closeMenu(): void { this.menuOpen.set(false); }
  toggleFaq(index: number): void { this.openFaq.set(this.openFaq() === index ? null : index); }
}
