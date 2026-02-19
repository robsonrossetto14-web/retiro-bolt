import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Router, useParams } from './components/Router';
import Auth from './components/Auth';
import AdminDashboard from './components/Admindashboard';
import PublicRegistration from './components/PublicRegistration';
import ApproveAccount from './components/ApproveAccount';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const params = useParams();
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  const approvalTokenFromQuery = query.get('token');

  if (path.startsWith('/inscricao/') && params.shareLink) {
    return <PublicRegistration />;
  }

  if (path.startsWith('/aprovar-conta/') && params.approvalToken) {
    return <ApproveAccount token={params.approvalToken} />;
  }

  if (path === '/aprovar-conta' && approvalTokenFromQuery) {
    return <ApproveAccount token={approvalTokenFromQuery} />;
  }

  if (loading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="text-slate-200 text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard />;
  }

  return (
    <div className="app-bg min-h-screen flex items-center justify-center">
      <div className="text-slate-200 text-xl">Acesso nao autorizado</div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
