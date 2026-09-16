import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/shell/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/*
 * Two pages stay eager on purpose. HomePage is the entry route, so splitting it
 * would cost a second round trip before the landing draws anything. NotFoundPage
 * is both the catch-all route and a component four pages render inline for a
 * missing record, so it would be duplicated into those chunks anyway.
 *
 * Everything else is split per route. No page has a default export, so each one
 * needs the shim. React.lazy resolves module.default and these are all named.
 */
const ProfilePage = lazy(() =>
   import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const QuickLogPage = lazy(() =>
   import('@/pages/fishing/QuickLogPage').then((m) => ({
      default: m.QuickLogPage,
   }))
);
const LogCatchPage = lazy(() =>
   import('@/pages/fishing/LogCatchPage').then((m) => ({
      default: m.LogCatchPage,
   }))
);
const MyCatchesPage = lazy(() =>
   import('@/pages/fishing/MyCatchesPage').then((m) => ({
      default: m.MyCatchesPage,
   }))
);
const CatchDetailPage = lazy(() =>
   import('@/pages/fishing/CatchDetailPage').then((m) => ({
      default: m.CatchDetailPage,
   }))
);
const EditCatchPage = lazy(() =>
   import('@/pages/fishing/EditCatchPage').then((m) => ({
      default: m.EditCatchPage,
   }))
);
const LogSitePage = lazy(() =>
   import('@/pages/fishing/LogSitePage').then((m) => ({
      default: m.LogSitePage,
   }))
);
const MySitesPage = lazy(() =>
   import('@/pages/fishing/MySitesPage').then((m) => ({
      default: m.MySitesPage,
   }))
);
const SiteDetailPage = lazy(() =>
   import('@/pages/fishing/SiteDetailPage').then((m) => ({
      default: m.SiteDetailPage,
   }))
);
const EditSitePage = lazy(() =>
   import('@/pages/fishing/EditSitePage').then((m) => ({
      default: m.EditSitePage,
   }))
);
const LogGearPage = lazy(() =>
   import('@/pages/fishing/LogGearPage').then((m) => ({
      default: m.LogGearPage,
   }))
);
const MyGearPage = lazy(() =>
   import('@/pages/fishing/MyGearPage').then((m) => ({
      default: m.MyGearPage,
   }))
);
const EditGearPage = lazy(() =>
   import('@/pages/fishing/EditGearPage').then((m) => ({
      default: m.EditGearPage,
   }))
);
const FeedPage = lazy(() =>
   import('@/pages/fishing/FeedPage').then((m) => ({ default: m.FeedPage }))
);

function App() {
   return (
      <Routes>
         <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/log" element={<QuickLogPage />} />
            <Route path="/catches/new" element={<LogCatchPage />} />
            <Route path="/catches/me" element={<MyCatchesPage />} />
            <Route path="/catches/:catchId" element={<CatchDetailPage />} />
            <Route path="/catches/:catchId/edit" element={<EditCatchPage />} />
            <Route path="/sites/new" element={<LogSitePage />} />
            <Route path="/sites/me" element={<MySitesPage />} />
            <Route path="/sites/:siteId" element={<SiteDetailPage />} />
            <Route path="/sites/:siteId/edit" element={<EditSitePage />} />
            <Route path="/gear/new" element={<LogGearPage />} />
            <Route path="/gear/me" element={<MyGearPage />} />
            <Route path="/gear/:gearId/edit" element={<EditGearPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="*" element={<NotFoundPage />} />
         </Route>
      </Routes>
   );
}

export default App;
