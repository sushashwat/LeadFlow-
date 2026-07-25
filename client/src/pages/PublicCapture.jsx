import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function PublicCapture() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('submitting');
    setError(null);
    try {
      await api.submitPublicLead(form);
      setStatus('done');
    } catch (err) {
      setError(err.details?.map((d) => d.msg).join(', ') || err.message);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="page public-page">
        <div className="card success-card">
          <h1>Thanks, {form.name.split(' ')[0]}.</h1>
          <p>We've got your details and someone from the team will be in touch shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page public-page">
      <div className="card">
        <h1>Talk to Digital Heroes</h1>
        <p className="subtitle">Tell us a bit about your project and we'll reach out.</p>

        <form onSubmit={handleSubmit} className="stacked-form">
          <label>
            Name*
            <input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Jordan Prospect"
            />
          </label>
          <label>
            Email*
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="jordan@company.com"
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </label>
          <label>
            Company
            <input value={form.company} onChange={(e) => update('company', e.target.value)} />
          </label>
          <label>
            What are you looking to build?
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => update('message', e.target.value)}
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Sending…' : 'Send'}
          </button>
        </form>

        <p className="fine-print">
          Team member? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
