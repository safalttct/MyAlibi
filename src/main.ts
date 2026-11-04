import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installChunkReloadGuard } from './app/core/utils/chunk-reload';

installChunkReloadGuard();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
