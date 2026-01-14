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
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Authenticated Layout Routes */}
        <Route path="/app" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="members" element={<MembersList />} />
          <Route path="members/new" element={<MemberForm />} />
          <Route path="members/edit/:id" element={<MemberForm />} />
          <Route path="tasks/new" element={<TaskForm />} />
          <Route path="schedule" element={<YearlySchedule />} />
          <Route path="schedule/adjustment" element={<ScheduleAdjustment />} />
          <Route path="reports" element={<Reports />} />

          {/* Default redirect to dashboard */}
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;