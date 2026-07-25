import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURE', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];
const STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  NURTURE: 'Nurture',
  PROPOSAL_SENT: 'Proposal sent',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listLeads({ page, limit: 10, status, search });
        setLeads(res.data);
        setPagination(res.pagination);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [status, search]
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load(1);
  }

  return (
    <div className="page dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-mark">LF</div>
          <div>
            <h1>LeadFlow</h1>
            <p className="subtitle">
              Signed in as {user.name} ({user.role})
            </p>
          </div>
        </div>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </header>

      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <input
            placeholder="Search name, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : leads.length === 0 ? (
        <p className="empty-state">
          No leads {isAdmin ? 'yet' : 'assigned to you yet'}.
        </p>
      ) : (
        <>
          <table className="lead-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link to={`/leads/${lead.id}`}>{lead.name}</Link>
                    <div className="cell-sub">{lead.email}</div>
                  </td>
                  <td>{lead.company || '—'}</td>
                  <td>
                    <span className={`status-pill status-${lead.status}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td>{new Date(lead.updated_at + 'Z').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>
              ← Prev
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} leads)
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => load(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}