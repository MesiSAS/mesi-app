import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';

import outputs from '../amplify_outputs.json';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import GlobalAssistant from './components/GlobalAssistant';
import ErrorBoundary from './components/ErrorBoundary';

import './index.css';

import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import DashboardAdmin from './DashboardAdmin.jsx';

Amplify.configure(outputs, {
  ssr: false,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />

          <Route
            path="/dashboard/:empresa"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly={true}>
                <DashboardAdmin />
              </ProtectedRoute>
            }
          />
        </Routes>
        <GlobalAssistant />
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
