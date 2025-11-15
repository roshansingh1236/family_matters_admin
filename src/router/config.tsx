
import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/home/page';
import RequestsPage from '../pages/requests/page';
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

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
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
    path: '/requests',
    element: <RequestsPage />,
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
    path: '/reports',
    element: <ReportsPage />,
  },
  {
    path: '/settings',
    element: <SettingsPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
