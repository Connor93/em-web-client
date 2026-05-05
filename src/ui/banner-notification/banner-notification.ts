import { settings } from '../../settings';

import './banner-notification.css';

export type BannerTier = 'critical' | 'event' | 'awakened' | 'info';

export interface BannerPayload {
  tier: BannerTier;
  text: string;
  icon?: string;
}

const DEFAULT_ICONS: Record<BannerTier, string> = {
  critical: '⚠',
  event: '★',
  awakened: '☄',
  info: '✦',
};

// Reading-speed model: comfortable subtitle pace is ~12–17 chars/sec.
// 65ms per char ≈ 15 cps; READ_BUFFER gives time to notice and orient.
const PER_CHAR_MS = 65;
const READ_BUFFER_MS = 1500;
const MIN_DURATION_MS = 7_000;
const MAX_DURATION_MS = 12_000;

const ENTER_ANIMATION_MS = 320;
const EXIT_ANIMATION_MS = 280;
const GAP_BETWEEN_BANNERS_MS = 180;

function computeDuration(text: string): number {
  const raw = text.length * PER_CHAR_MS + READ_BUFFER_MS;
  return Math.min(Math.max(raw, MIN_DURATION_MS), MAX_DURATION_MS);
}

export class BannerNotification {
  private container: HTMLElement;
  private iconElement: HTMLElement;
  private textElement: HTMLElement;
  private closeButton: HTMLButtonElement;
  private queue: BannerPayload[] = [];
  private current: BannerPayload | null = null;
  private displayTimer: number | null = null;
  private hideTimer: number | null = null;

  constructor() {
    this.container = document.getElementById('banner-notification')!;
    this.iconElement = this.container.querySelector(
      '.banner-notification__icon',
    )!;
    this.textElement = this.container.querySelector(
      '.banner-notification__text',
    )!;
    this.closeButton = this.container.querySelector(
      '.banner-notification__close',
    )!;

    this.closeButton.addEventListener('click', () => {
      this.dismissCurrent();
    });
  }

  show(payload: BannerPayload): void {
    if (settings.get('bannerNotifications') === 'disabled') return;
    this.queue.push(payload);
    this.processQueue();
  }

  /** Closes the visible banner and advances the queue. */
  dismissCurrent(): void {
    if (!this.current) return;
    this.cancelTimers();
    this.startExit();
  }

  /** Drops queued banners and hides any currently-visible one. */
  clear(): void {
    this.queue = [];
    if (this.current) this.dismissCurrent();
  }

  private processQueue(): void {
    if (this.current || this.queue.length === 0) return;

    if (settings.get('bannerNotifications') === 'disabled') {
      this.queue = [];
      return;
    }

    const next = this.queue.shift()!;
    this.current = next;
    this.render(next);

    document.body.classList.add('has-banner');
    this.container.classList.remove('hidden', 'banner-notification--exiting');

    requestAnimationFrame(() => {
      this.container.classList.add('banner-notification--show');
    });

    const visibleDuration = computeDuration(next.text);
    this.displayTimer = window.setTimeout(() => {
      this.displayTimer = null;
      this.startExit();
    }, visibleDuration + ENTER_ANIMATION_MS);
  }

  private render(payload: BannerPayload): void {
    this.container.classList.remove(
      'banner-notification--critical',
      'banner-notification--event',
      'banner-notification--awakened',
      'banner-notification--info',
    );
    this.container.classList.add(`banner-notification--${payload.tier}`);
    this.iconElement.textContent = payload.icon ?? DEFAULT_ICONS[payload.tier];
    this.textElement.textContent = payload.text;
  }

  private startExit(): void {
    if (!this.current) return;
    this.container.classList.remove('banner-notification--show');
    this.container.classList.add('banner-notification--exiting');

    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.container.classList.add('hidden');
      this.container.classList.remove('banner-notification--exiting');
      document.body.classList.remove('has-banner');
      this.current = null;

      window.setTimeout(() => this.processQueue(), GAP_BETWEEN_BANNERS_MS);
    }, EXIT_ANIMATION_MS);
  }

  private cancelTimers(): void {
    if (this.displayTimer !== null) {
      window.clearTimeout(this.displayTimer);
      this.displayTimer = null;
    }
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
