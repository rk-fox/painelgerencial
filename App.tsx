import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MembersList from './pages/MembersList';
import MemberForm from './pages/MemberForm';
import TaskForm from './pages/TaskForm';
import Reports from './pages/Reports';
import YearlySchedule from './pages/YearlySchedule';
import ScheduleAdjustment from './pages/ScheduleAdjustment';
import MonthlyPlanner from './pages/MonthlyPlanner';
import SdiaPage from './pages/Sdia';
import ResetPassword from './pages/ResetPassword';
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Authenticated Layout Routes */}
        <Route path="/app" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="members" element={<MembersList />} />
          <Route path="members/new" element={<MemberForm />} />
          <Route path="members/edit/:id" element={<MemberForm />} />
          <Route path="tasks/new" element={<TaskForm />} />
          <Route path="tasks/planner" element={<MonthlyPlanner />} />
          <Route path="schedule" element={<YearlySchedule />} />
          <Route path="schedule/adjustment" element={<ScheduleAdjustment />} />
          <Route path="sdia" element={<SdiaPage />} />
          <Route path="reports" element={<Reports />} />

          {/* Default redirect — CH goes to tasks, others go to dashboard */}
          <Route path="" element={<DefaultRedirect />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

const DefaultRedirect: React.FC = () => {
  const userJson = localStorage.getItem('currentUser');
  const sector = userJson ? JSON.parse(userJson).sector : null;
  return <Navigate to={sector === 'CH' ? 'tasks/new' : 'dashboard'} replace />;
};

export default App;