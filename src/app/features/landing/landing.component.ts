import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MovesAuthService } from '../../services/moves-auth.service';
import { GET_THE_APP_PRODUCTS } from '@taliferro/ui/platform/get-the-app.model';
import { SITE_URL, SeoService } from '../../services/seo.service';
import { ThemeService } from '../../services/theme.service';
import { AlsoFromUsComponent } from '../../shared/also-from-us/also-from-us.component';
import { PlatformMenuComponent } from '../../shared/platform-menu/platform-menu.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

interface Faq { question: string; answer: string; }
interface Testimonial { quote: string; name: string; role: string; result: string; }

@Component({
  selector: 'app-landing',
  host: { class: 'tt-page' },
  standalone: true,
  imports: [SiteFooterComponent, PlatformMenuComponent, AlsoFromUsComponent, CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnDestroy {
  readonly theme = inject(ThemeService);

  /** TODD demo video beside the quote (handoff_landing_video): light/dark MP4s in assets/video/. */
  private readonly demoVideo = viewChild<ElementRef<HTMLVideoElement>>('demoVideo');
  /** The MP4s aren't in assets yet (or failed to load): hide the empty frame rather than show it. */
  readonly demoVideoMissing = signal(false);
  private readonly reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private demoInView = false;
  private demoObserver?: IntersectionObserver;
  private readonly seo = inject(SeoService);
  private readonly auth = inject(MovesAuthService);
  private readonly router = inject(Router);
  // The universal menu (and its ⌘K search) sits inline in this page's nav;
  // app.component leaves its floating copy off on '/'.
  readonly isLoggedIn$ = this.auth.isLoggedIn();
  readonly isAdmin$ = this.auth.getUser().pipe(map(user => user?.uid === environment.taliferroTenantId));
  readonly userName$ = this.auth.getUser().pipe(map(user => user?.displayName || ''));
  readonly userEmail$ = this.auth.getUser().pipe(map(user => user?.email || ''));
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

  constructor() {
    // What Moves is and the demo video, for search engines (prerendered).
    // The home title and description stay in index.html.
    const description = 'Moves draws every project as a line of moves against today. Gaps, stalls and wrong order show up as breaks, and TODD fixes the small ones within rules you set, with Undo.';
    this.seo.structuredData('moves-app', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Moves',
      url: `${SITE_URL}/`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS',
      description,
      publisher: { '@type': 'Organization', name: 'Taliferro Tech', url: 'https://taliferro.tech' },
      offers: {
        '@type': 'Offer',
        price: GET_THE_APP_PRODUCTS.moves.monthlyPrice.replace(/[^0-9.]/g, ''),
        priceCurrency: 'USD',
        url: `${SITE_URL}/pricing`,
      },
    });
    this.seo.structuredData('moves-demo-video', {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'TODD keeps work moving in Moves',
      description: 'TODD spots a stalled task and reassigns it, a project lead gives an unowned task to Priya from a push notification, and TODD reorders two tasks so a deadline holds.',
      thumbnailUrl: [`${SITE_URL}/assets/video/moves-todd-demo-light.jpg`, `${SITE_URL}/assets/video/moves-todd-demo-dark.jpg`],
      contentUrl: `${SITE_URL}/assets/video/moves-todd-demo-light.mp4`,
      uploadDate: '2026-10-13',
      duration: 'PT20S',
    });

    // Browser only (the landing page is prerendered): reduced motion gets controls
    // and no autoplay; otherwise play only while at least 25% is on screen.
    afterNextRender(() => {
      const video = this.demoVideo()?.nativeElement;
      if (!video) return;
      // Angular creates the element in code, where the muted attribute alone
      // doesn't mute it - and browsers only autoplay muted video.
      video.muted = true;
      if (this.reducedMotion) {
        video.autoplay = false;
        video.controls = true;
        video.pause();
        return;
      }
      if (typeof IntersectionObserver === 'undefined') return;
      this.demoObserver = new IntersectionObserver(([entry]) => {
        this.demoInView = entry.intersectionRatio >= 0.25;
        if (this.demoInView) void video.play().catch(() => undefined);
        else video.pause();
      }, { threshold: [0, 0.25] });
      this.demoObserver.observe(video);
      // From here the observer starts and stops playback; autoplay would also
      // restart it off screen whenever the theme swaps the source.
      video.autoplay = false;
    });

    // The theme picks the source; when it changes, load and start the new one.
    effect(() => {
      this.theme.isDark();
      untracked(() => {
        if (typeof window === 'undefined') return;
        const video = this.demoVideo()?.nativeElement;
        if (!video) return;
        setTimeout(() => {
          video.load();
          if (!this.reducedMotion && this.demoInView) void video.play().catch(() => undefined);
        });
      });
    });
  }

  ngOnDestroy(): void {
    this.demoObserver?.disconnect();
    // Only the home page describes the app and its video.
    this.seo.removeStructuredData('moves-app');
    this.seo.removeStructuredData('moves-demo-video');
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
  toggleFaq(index: number): void { this.openFaq.set(this.openFaq() === index ? null : index); }
}
