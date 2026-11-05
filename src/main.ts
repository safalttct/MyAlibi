import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { inject as injectVercelAnalytics } from '@vercel/analytics';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installChunkReloadGuard } from './app/core/utils/chunk-reload';

installChunkReloadGuard();

// Vercel Web Analytics — aliased to avoid clashing with Angular's `inject()`.
// disableAutoTrack: Angular Router navigations are reported manually in App.
injectVercelAnalytics({
  framework: 'angular',
  mode: isDevMode() ? 'development' : 'production',
  disableAutoTrack: true,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
