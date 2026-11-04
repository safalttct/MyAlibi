import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferred: BeforeInstallPromptEvent | null = null;

  /** True when the browser can show a native install prompt. */
  readonly canInstall = signal(false);
  /** True when already running as an installed standalone app. */
  readonly isStandalone = signal(this.detectStandalone());

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.canInstall.set(false);
      this.isStandalone.set(true);
    });

    // Re-check when display mode changes (e.g. after install).
    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
      this.isStandalone.set(this.detectStandalone());
    });
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferred) {
      return 'unavailable';
    }
    const promptEvent = this.deferred;
    this.deferred = null;
    this.canInstall.set(false);
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      this.isStandalone.set(true);
    }
    return outcome;
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const media = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    return media || iosStandalone;
  }
}
