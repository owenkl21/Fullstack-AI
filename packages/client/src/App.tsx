import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CatchDetailPage } from '@/pages/fishing/CatchDetailPage';
import { LogCatchPage } from '@/pages/fishing/LogCatchPage';
import { LogSitePage } from '@/pages/fishing/LogSitePage';
import { SiteDetailPage } from '@/pages/fishing/SiteDetailPage';

function App() {
   return (
      <Routes>
         <Route path="/" element={<HomePage />} />
         <Route path="/profile" element={<ProfilePage />} />
         <Route path="/catches/new" element={<LogCatchPage />} />
         <Route path="/catches/:catchId" element={<CatchDetailPage />} />
         <Route path="/sites/new" element={<LogSitePage />} />
         <Route path="/sites/:siteId" element={<SiteDetailPage />} />
         <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
   );
}

export default App;
