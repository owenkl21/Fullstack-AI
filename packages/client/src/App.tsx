import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/shell/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { lazyRoute } from '@/lib/lazy-route';

/*
 * Two pages stay eager on purpose. HomePage is the entry route, so splitting it
 * would cost a second round trip before the landing draws anything. NotFoundPage
 * is both the catch-all route and a component four pages render inline for a
 * missing record, so it would be duplicated into those chunks anyway.
 *
 * Everything else is split per route. No page has a default export, so each one
 * needs the shim. React.lazy resolves module.default and these are all named.
 */
const ProfilePage = lazyRoute(() =>
   import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const NotificationsPage = lazyRoute(() =>
   import('@/pages/NotificationsPage').then((m) => ({
      default: m.NotificationsPage,
   }))
);
const QuickLogPage = lazyRoute(() =>
   import('@/pages/fishing/QuickLogPage').then((m) => ({
      default: m.QuickLogPage,
   }))
);
const MyCatchesPage = lazyRoute(() =>
   import('@/pages/fishing/MyCatchesPage').then((m) => ({
      default: m.MyCatchesPage,
   }))
);
const CatchDetailPage = lazyRoute(() =>
   import('@/pages/fishing/CatchDetailPage').then((m) => ({
      default: m.CatchDetailPage,
   }))
);
const EditCatchPage = lazyRoute(() =>
   import('@/pages/fishing/EditCatchPage').then((m) => ({
      default: m.EditCatchPage,
   }))
);
const LogSitePage = lazyRoute(() =>
   import('@/pages/fishing/LogSitePage').then((m) => ({
      default: m.LogSitePage,
   }))
);
const MySitesPage = lazyRoute(() =>
   import('@/pages/fishing/MySitesPage').then((m) => ({
      default: m.MySitesPage,
   }))
);
const SiteDetailPage = lazyRoute(() =>
   import('@/pages/fishing/SiteDetailPage').then((m) => ({
      default: m.SiteDetailPage,
   }))
);
const EditSitePage = lazyRoute(() =>
   import('@/pages/fishing/EditSitePage').then((m) => ({
      default: m.EditSitePage,
   }))
);
const LogGearPage = lazyRoute(() =>
   import('@/pages/fishing/LogGearPage').then((m) => ({
      default: m.LogGearPage,
   }))
);
const MyGearPage = lazyRoute(() =>
   import('@/pages/fishing/MyGearPage').then((m) => ({
      default: m.MyGearPage,
   }))
);
const EditGearPage = lazyRoute(() =>
   import('@/pages/fishing/EditGearPage').then((m) => ({
      default: m.EditGearPage,
   }))
);
const FeedPage = lazyRoute(() =>
   import('@/pages/fishing/FeedPage').then((m) => ({ default: m.FeedPage }))
);

const SignInPage = lazyRoute(() =>
   import('@/pages/auth/SignInPage').then((m) => ({ default: m.SignInPage }))
);
const SignUpPage = lazyRoute(() =>
   import('@/pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage }))
);
const ForgotPasswordPage = lazyRoute(() =>
   import('@/pages/auth/ForgotPasswordPage').then((m) => ({
      default: m.ForgotPasswordPage,
   }))
);
const ResetPasswordPage = lazyRoute(() =>
   import('@/pages/auth/ResetPasswordPage').then((m) => ({
      default: m.ResetPasswordPage,
   }))
);
const VerifyEmailPage = lazyRoute(() =>
   import('@/pages/auth/VerifyEmailPage').then((m) => ({
      default: m.VerifyEmailPage,
   }))
);
const AnglerPage = lazyRoute(() =>
   import('@/pages/AnglerPage').then((m) => ({ default: m.AnglerPage }))
);
const AnglersPage = lazyRoute(() =>
   import('@/pages/AnglersPage').then((m) => ({ default: m.AnglersPage }))
);
const MapPage = lazyRoute(() =>
   import('@/pages/fishing/MapPage').then((m) => ({ default: m.MapPage }))
);
const InsightsPage = lazyRoute(() =>
   import('@/pages/InsightsPage').then((m) => ({ default: m.InsightsPage }))
);
const SavedPage = lazyRoute(() =>
   import('@/pages/fishing/SavedPage').then((m) => ({ default: m.SavedPage }))
);
const ForecastPage = lazyRoute(() =>
   import('@/pages/fishing/ForecastPage').then((m) => ({
      default: m.ForecastPage,
   }))
);
const CompetitionsPage = lazyRoute(() =>
   import('@/pages/social/CompetitionsPage').then((m) => ({
      default: m.CompetitionsPage,
   }))
);
const NewCompetitionPage = lazyRoute(() =>
   import('@/pages/social/NewCompetitionPage').then((m) => ({
      default: m.NewCompetitionPage,
   }))
);
const CompetitionPage = lazyRoute(() =>
   import('@/pages/social/CompetitionPage').then((m) => ({
      default: m.CompetitionPage,
   }))
);
const BoardsPage = lazyRoute(() =>
   import('@/pages/social/BoardsPage').then((m) => ({ default: m.BoardsPage }))
);
const PrivacyPage = lazyRoute(() =>
   import('@/pages/legal/LegalPage').then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazyRoute(() =>
   import('@/pages/legal/LegalPage').then((m) => ({ default: m.TermsPage }))
);
const AccountPage = lazyRoute(() =>
   import('@/pages/auth/AccountPage').then((m) => ({ default: m.AccountPage }))
);
/* The admin panel. Split like the rest, and worth splitting more than most:
   it is a page one account ever opens, and nobody else should pay for it in
   the bundle. What it may show is decided by the server, not by this route. */
const AdminPage = lazyRoute(() =>
   import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);

function App() {
   return (
      <Routes>
         <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            {/*
             * One log. /catches/new was the long form and is now the same
             * page, so a link from a spot, a draft or an old bookmark lands
             * on the log the product actually has. LogCatchPage stays for the
             * edit route, which mounts its CatchForm.
             */}
            <Route path="/log" element={<QuickLogPage />} />
            <Route path="/catches/new" element={<QuickLogPage />} />
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
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/anglers" element={<AnglersPage />} />
            <Route path="/anglers/:userId" element={<AnglerPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/competitions/new" element={<NewCompetitionPage />} />
            <Route
               path="/competitions/:competitionId"
               element={<CompetitionPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
         </Route>
      </Routes>
   );
}

export default App;
