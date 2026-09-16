import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/shell/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CatchDetailPage } from '@/pages/fishing/CatchDetailPage';
import { EditCatchPage } from '@/pages/fishing/EditCatchPage';
import { EditSitePage } from '@/pages/fishing/EditSitePage';
import { LogCatchPage } from '@/pages/fishing/LogCatchPage';
import { LogSitePage } from '@/pages/fishing/LogSitePage';
import { MyCatchesPage } from '@/pages/fishing/MyCatchesPage';
import { MySitesPage } from '@/pages/fishing/MySitesPage';
import { SiteDetailPage } from '@/pages/fishing/SiteDetailPage';
import { LogGearPage } from '@/pages/fishing/LogGearPage';
import { MyGearPage } from '@/pages/fishing/MyGearPage';
import { EditGearPage } from '@/pages/fishing/EditGearPage';
import { FeedPage } from '@/pages/fishing/FeedPage';
import { QuickLogPage } from '@/pages/fishing/QuickLogPage';

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
