
import type { RouteObject } from 'react-router-dom';
import HomePage from '../pages/home/page';
import RequestsPage from '../pages/requests/page';
import InquiriesPage from '../pages/inquiries/page';
import SurrogatesPage from '../pages/surrogates/page';
import SurrogateProfilePage from '../pages/surrogates/profile';
import ParentsPage from '../pages/parents/page';
import ParentProfilePage from '../pages/parents/profile';
import MatchesPage from '../pages/matches/page';
import AppointmentsPage from '../pages/appointments/page';
import ReportsPage from '../pages/reports/page';
import SettingsPage from '../pages/settings/page';
import CalendarPage from '../pages/calendar/page';
import PaymentsPage from '../pages/payments/page';
import MedicalPage from '../pages/medical/page';
import ContractsPage from '../pages/contracts/page';
import LoginPage from '../pages/auth/login/page';
import SignupPage from '../pages/auth/signup/page';
import NotFound from '../pages/NotFound';
import TasksPage from '../pages/tasks/page';
import BabyWatchPage from '../pages/baby-watch/page';
import MessagesPage from '../pages/messages/page';
import JourneysPage from '../pages/journeys/page';
import FinancialsPage from '../pages/financials/page';
import LandingPage from '../pages/landing/page';
import ScreeningPage from '../pages/screening/page';
import ProfilePreviewPage from '../components/feature/ProfilePreviewPage';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/requests',
    element: <RequestsPage />,
  },
  {
    path: '/inquiries',
    element: <InquiriesPage />,
  },
  {
    path: '/surrogates',
    element: <SurrogatesPage />,
  },
  {
    path: '/surrogates/:id',
    element: <SurrogateProfilePage />,
  },
  {
    path: '/parents',
    element: <ParentsPage />,
  },
  {
    path: '/parents/:id',
    element: <ParentProfilePage />,
  },
  {
    path: '/matches',
    element: <MatchesPage />,
  },
  {
    path: '/appointments',
    element: <AppointmentsPage />,
  },
  {
    path: '/reports',
    element: <ReportsPage />,
  },
  {
    path: '/settings',
    element: <SettingsPage />,
  },
  {
    path: '/calendar',
    element: <CalendarPage />,
  },
  {
    path: '/payments',
    element: <PaymentsPage />,
  },
  {
    path: '/medical',
    element: <MedicalPage />,
  },
  {
    path: '/contracts',
    element: <ContractsPage />,
  },
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/signup',
    element: <SignupPage />,
  },
  {
    path: '/tasks',
    element: <TasksPage />,
  },
  {
    path: '/baby-watch',
    element: <BabyWatchPage />,
  },
  {
    path: '/messages',
    element: <MessagesPage />,
  },
  {
    path: '/journeys',
    element: <JourneysPage />,
  },
  {
    path: '/financials',
    element: <FinancialsPage />,
  },
  {
    path: '/landing',
    element: <LandingPage />,
  },
  {
    path: '/screening',
    element: <ScreeningPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
  {
    path: '/profile-preview/:id',
    element: <ProfilePreviewPage />,
  }
];

export default routes;
