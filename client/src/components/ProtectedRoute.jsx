import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// NOTE: this only controls what the UI shows. It is a convenience, not a
// security boundary - the API re-checks every permission server-side
// regardless of what this component decides to render.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}
