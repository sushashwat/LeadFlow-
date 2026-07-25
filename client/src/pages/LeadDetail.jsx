import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURE', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];

export default function LeadDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadRes, notesRes, activityRes] = await Promise.all([
        api.getLead(id),
        api.listNotes(id),
        api.listActivity(id),
      ]);
      setLead(leadRes.data);
      setNotes(notesRes.data);
      setActivity(activityRes.data);
      if (isAdmin) {
        const usersRes = await api.listUsers();
        setUsers(usersRes.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleStatusChange(newStatus) {
    try {
      const res = await api.updateLead(id, { status: newStatus });
      setLead(res.data);
      const activityRes = await api.listActivity(id);
      setActivity(activityRes.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssign(userId) {
    try {
      const res = await api.assignLead(id, Number(userId));
      setLead(res.data);
      const activityRes = await api.listActivity(id);
      setActivity(activityRes.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      await api.addNote(id, newNote);
      setNewNote('');
      const [notesRes, activityRes] = await Promise.all([
        api.listNotes(id),
        api.listActivity(id),
      ]);
      setNotes(notesRes.data);
      setActivity(activityRes.data);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page">Loading…</div>;
  if (error && !lead)
    return (
      <div className="page">
        <p className="error-text">{error}</p>
        <Link to="/dashboard">← Back</Link>
      </div>
    );

  const assignedUser = users.find((u) => u.id === lead.assigned_to);

  return (
    <div className="page lead-detail">
      <Link to="/dashboard" className="back-link">
        ← Back to dashboard
      </Link>

      <div className="lead-detail-grid">
        <div className="card">
          <h1>{lead.name}</h1>
          <p className="subtitle">{lead.email}</p>
          <dl className="lead-facts">
            <dt>Company</dt>
            <dd>{lead.company || '—'}</dd>
            <dt>Phone</dt>
            <dd>{lead.phone || '—'}</dd>
            <dt>Source</dt>
            <dd>{lead.source}</dd>
            <dt>Message</dt>
            <dd>{lead.message || '—'}</dd>
          </dl>

          <div className="control-row">
            <label>
              Status
              <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            {isAdmin && (
              <label>
                Assigned to
                <select
                  value={lead.assigned_to || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                >
                  <option value="" disabled>
                    Unassigned
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!isAdmin && (
              <p className="fine-print">
                Assigned to: {assignedUser ? assignedUser.name : 'You'}
              </p>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="card">
          <h2>Notes</h2>
          <form onSubmit={handleAddNote} className="note-form">
            <textarea
              rows={3}
              placeholder="Add a note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <button type="submit">Add note</button>
          </form>
          <ul className="notes-list">
            {notes.map((n) => (
              <li key={n.id}>
                <p>{n.note}</p>
                <span className="cell-sub">
                  {n.author} · {new Date(n.created_at + 'Z').toLocaleString()}
                </span>
              </li>
            ))}
            {notes.length === 0 && <p className="empty-state">No notes yet.</p>}
          </ul>
        </div>

        <div className="card">
          <h2>Activity trail</h2>
          <ul className="activity-list">
            {activity.map((a) => (
              <li key={a.id}>
                <strong>{a.action.replace('_', ' ')}</strong>
                {a.details && <span> — {a.details}</span>}
                <div className="cell-sub">
                  {a.actor || 'System'} · {new Date(a.created_at + 'Z').toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}