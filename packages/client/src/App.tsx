import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CatchDetailPage } from '@/pages/fishing/CatchDetailPage';
import { EditCatchPage } from '@/pages/fishing/EditCatchPage';
import { EditSitePage } from '@/pages/fishing/EditSitePage';
import { LogCatchPage } from '@/pages/fishing/LogCatchPage';
import { LogSitePage } from '@/pages/fishing/LogSitePage';
import { MyCatchesPage } from '@/pages/fishing/MyCatchesPage';
import { MySitesPage } from '@/pages/fishing/MySitesPage';
import { SiteDetailPage } from '@/pages/fishing/SiteDetailPage';

function App() {
   return (
      <Routes>
         <Route path="/" element={<HomePage />} />
         <Route path="/profile" element={<ProfilePage />} />
         <Route path="/catches/new" element={<LogCatchPage />} />
         <Route path="/catches/me" element={<MyCatchesPage />} />
         <Route path="/catches/:catchId" element={<CatchDetailPage />} />
         <Route path="/catches/:catchId/edit" element={<EditCatchPage />} />
         <Route path="/sites/new" element={<LogSitePage />} />
         <Route path="/sites/me" element={<MySitesPage />} />
         <Route path="/sites/:siteId" element={<SiteDetailPage />} />
         <Route path="/sites/:siteId/edit" element={<EditSitePage />} />
         <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
   );
}

export default App;
