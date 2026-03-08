import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';

function App() {
   return (
      // Centralized route table for the app.
      // Add more pages by adding another <Route path="..." element={<... />} />.
      <Routes>
         <Route path="/" element={<HomePage />} />
         <Route path="/profile" element={<ProfilePage />} />

         {/*
           Fallback route: any unknown URL is redirected to the landing page.
           This keeps navigation predictable while you build out more pages.
         */}
         <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
   );
}

export default App;
