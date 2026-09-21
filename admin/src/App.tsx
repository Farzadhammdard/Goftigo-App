import {useEffect} from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {useAuthStore} from './store/authStore';
import {Layout} from './components/Layout';
import {LoginPage} from './pages/LoginPage';
import {DashboardPage} from './pages/DashboardPage';
import {UsersPage} from './pages/UsersPage';
import {UserDetailPage} from './pages/UserDetailPage';
import {CreateUserPage} from './pages/CreateUserPage';
import {GroupsPage} from './pages/GroupsPage';
import {PostsPage} from './pages/PostsPage';
import {SettingsPage} from './pages/SettingsPage';
import {AdminsPage} from './pages/AdminsPage';
import {HealthPage} from './pages/HealthPage';
import {ChatPage} from './pages/ChatPage';
import {OtpPage} from './pages/OtpPage';

function ProtectedRoute({children}: {children: React.ReactNode}) {
  const {isAuthenticated, isLoading} = useAuthStore();
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const {loadSession} = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/new" element={<CreateUserPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="otp" element={<OtpPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
