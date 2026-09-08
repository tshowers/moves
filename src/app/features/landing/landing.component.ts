import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

interface Faq { question: string; answer: string; }
interface Testimonial { quote: string; name: string; role: string; result: string; }

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

  readonly numbers = [
    { value: '12,741', label: 'signals detected' },
    { value: '3,791', label: 'next steps identified' },
    { value: '1,255', label: 'follow-ups surfaced' },
    { value: '449', label: 'opportunities kept moving' }
  ];

  readonly testimonials: Testimonial[] = [
    { quote: 'Moves helped us stop losing revenue in the handoff. We saw which proposals were going quiet, acted sooner, and turned more open work into closed business.', name: 'Don Jones', role: 'Revenue Operations', result: 'More proposals moving' },
    { quote: 'Before Moves, our project board told us what existed. Now it tells us what is at risk. That visibility helped us protect renewals and create room for new revenue.', name: 'Linda Hood', role: 'Client Services', result: 'Renewals protected' },
    { quote: 'The biggest change was simple: no more guessing what to do next. Our team follows through faster, and the work that used to sit in limbo is producing revenue again.', name: 'Celeste Rodgers', role: 'Growth & Partnerships', result: 'Faster follow-through' }
  ];

  readonly faqs: Faq[] = [
    { question: 'What makes a move different from a task?', answer: 'A move is tied to the work it serves and watched for momentum, so TODD can surface when a next action is aging or at risk.' },
    { question: 'Can Moves connect to contacts and campaigns?', answer: 'Yes. Moves keeps the contact, deal, or campaign behind the work attached to the next action.' },
    { question: 'Who is Moves for?', answer: 'Anyone managing follow-up, deliverables, or shared work who wants to know what needs action next.' }
    ,{ question: 'How does Moves work with projects?', answer: 'Projects stay connected to their individual moves, so teams can see the next action, the owner, the blocker, and the momentum behind the bigger outcome.' }
    ,{ question: 'Can Moves help recover stalled revenue?', answer: 'Moves surfaces aging proposals, follow-ups, and client commitments so your team can act before an opportunity quietly goes cold.' }
  ];

  toggleMenu(): void { this.menuOpen.update(open => !open); }
  closeMenu(): void { this.menuOpen.set(false); }
  toggleFaq(index: number): void { this.openFaq.set(this.openFaq() === index ? null : index); }
}
