import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AppShell } from './layout/app-shell';
import { LoginPage } from './features/login/login.page';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · MyAlibi',
    component: LoginPage,
  },
  {
    path: 'share/hr/:token',
    title: 'HR review · MyAlibi',
    loadComponent: () =>
      import('./features/share/hr-share-view.page').then((m) => m.HrShareViewPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: AppShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · MyAlibi',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'records',
        title: 'Records · MyAlibi',
        loadComponent: () =>
          import('./features/leave-records/leave-records.page').then((m) => m.LeaveRecordsPage),
      },
      {
        path: 'calendar',
        title: 'Calendar · MyAlibi',
        loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'analytics',
        title: 'Analytics · MyAlibi',
        loadComponent: () =>
          import('./features/analytics/analytics.page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'comp-off',
        title: 'Comp Off · MyAlibi',
        loadComponent: () => import('./features/comp-off/comp-off.page').then((m) => m.CompOffPage),
      },
      { path: 'settings', pathMatch: 'full', redirectTo: 'settings/allocations' },
      {
        path: 'settings/allocations',
        title: 'Allocations · MyAlibi',
        loadComponent: () =>
          import('./features/settings/allocation-settings.page').then(
            (m) => m.AllocationSettingsPage,
          ),
      },
      {
        path: 'settings/share',
        title: 'Share to HR · MyAlibi',
        loadComponent: () =>
          import('./features/settings/hr-share.page').then((m) => m.HrSharePage),
      },
      {
        path: 'settings/profile',
        title: 'Profile · MyAlibi',
        loadComponent: () => import('./features/settings/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'settings/data',
        title: 'Data management · MyAlibi',
        loadComponent: () =>
          import('./features/settings/data-management.page').then((m) => m.DataManagementPage),
      },
      {
        path: 'settings/about',
        title: 'About · MyAlibi',
        loadComponent: () => import('./features/settings/about.page').then((m) => m.AboutPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
