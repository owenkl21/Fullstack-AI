import { useEffect, useState } from 'react';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';

const getCurrentPath = () => window.location.pathname;

function App() {
   const [path, setPath] = useState(getCurrentPath);

   useEffect(() => {
      const handleRouteChange = () => setPath(getCurrentPath());
      window.addEventListener('popstate', handleRouteChange);

      return () => {
         window.removeEventListener('popstate', handleRouteChange);
      };
   }, []);

   if (path === '/profile') {
      return <ProfilePage />;
   }

   return <HomePage />;
}

export default App;
