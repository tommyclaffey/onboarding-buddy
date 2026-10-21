// Routes. Each role lands on its own home (auth.homeFor). Hire screens show the Ask Buddy bar.
import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { homeFor, useAuth } from './auth';
import { AskBuddy, Sidebar } from './components/Shell';
import type { Role } from './lib/types';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Welcome from './pages/hire/Welcome';
import Today from './pages/hire/Today';
import Journey from './pages/hire/Journey';
import TaskPage from './pages/hire/TaskPage';
import AppPage from './pages/hire/AppPage';
import Training from './pages/hire/Training';
import Paperwork from './pages/hire/Paperwork';
import Tools from './pages/hire/Tools';
import People from './pages/hire/People';
import Graduation from './pages/hire/Graduation';
import Overview from './pages/admin/Overview';
import HireDetail from './pages/admin/HireDetail';
import JourneyBuilder from './pages/admin/JourneyBuilder';
import Apps from './pages/admin/Apps';
import AppDetail from './pages/admin/AppDetail';
import Videos from './pages/admin/Videos';
import MyTasks from './pages/owner/MyTasks';
import Account from './pages/Account';
import Invite from './pages/Invite';
import EmailSettings from './pages/admin/EmailSettings';

function Guard({ roles, children, ask }: { roles?: Role[]; children: ReactNode; ask?: boolean }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return (
    <div className="app">
      <Sidebar />
      {children}
      {ask && <AskBuddy />}
    </div>
  );
}

// Guided walkthrough, only in the static portfolio demo build (VITE_STATIC_DEMO=1).
const DemoTour = import.meta.env.VITE_STATIC_DEMO === '1' ? lazy(() => import('./demo/DemoTour')) : null;

export default function App() {
  const { user, ready } = useAuth();
  const H: Role[] = ['hire'];
  const A: Role[] = ['admin'];
  return (
    <>
    {DemoTour && user && <Suspense fallback={null}><DemoTour /></Suspense>}
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/demo" element={<Login />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/welcome" element={<Guard roles={H} ask><Welcome /></Guard>} />
      <Route path="/today" element={<Guard roles={H} ask><Today /></Guard>} />
      <Route path="/journey" element={<Guard roles={H} ask><Journey /></Guard>} />
      <Route path="/tasks/:id" element={<Guard roles={H} ask><TaskPage /></Guard>} />
      <Route path="/apps/:key" element={<Guard ask><AppPage /></Guard>} />
      <Route path="/training" element={<Guard roles={H} ask><Training /></Guard>} />
      <Route path="/paperwork" element={<Guard roles={H} ask><Paperwork /></Guard>} />
      <Route path="/tools" element={<Guard roles={H} ask><Tools /></Guard>} />
      <Route path="/people" element={<Guard roles={H} ask><People /></Guard>} />
      <Route path="/graduation" element={<Guard roles={H} ask><Graduation /></Guard>} />
      <Route path="/inbox" element={<Guard ask={user?.role === 'hire'}><Inbox /></Guard>} />
      <Route path="/account" element={<Guard ask={user?.role === 'hire'}><Account /></Guard>} />
      <Route path="/tasks" element={<Guard roles={['admin', 'member']}><MyTasks /></Guard>} />
      <Route path="/admin" element={<Guard roles={A}><Overview /></Guard>} />
      <Route path="/admin/hires/:id" element={<Guard roles={A}><HireDetail /></Guard>} />
      <Route path="/admin/journeys/:id" element={<Guard roles={A}><JourneyBuilder /></Guard>} />
      <Route path="/admin/apps" element={<Guard roles={A}><Apps /></Guard>} />
      <Route path="/admin/apps/:key" element={<Guard roles={A}><AppDetail /></Guard>} />
      <Route path="/admin/videos" element={<Guard roles={A}><Videos /></Guard>} />
      <Route path="/admin/settings/email" element={<Guard roles={A}><EmailSettings /></Guard>} />
      <Route path="*" element={ready ? <Navigate to={homeFor(user)} replace /> : <div className="loading">Loading…</div>} />
    </Routes>
    </>
  );
}
