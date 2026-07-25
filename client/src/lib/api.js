const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('leadflow_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  submitPublicLead: (payload) =>
    request('/api/public/leads', { method: 'POST', body: payload, auth: false }),

  listLeads: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)
    ).toString();
    return request(`/api/leads${qs ? `?${qs}` : ''}`);
  },

  getLead: (id) => request(`/api/leads/${id}`),
  updateLead: (id, patch) => request(`/api/leads/${id}`, { method: 'PATCH', body: patch }),
  assignLead: (id, assignedTo) =>
    request(`/api/leads/${id}/assign`, { method: 'PATCH', body: { assigned_to: assignedTo } }),

  listNotes: (id) => request(`/api/leads/${id}/notes`),
  addNote: (id, note) => request(`/api/leads/${id}/notes`, { method: 'POST', body: { note } }),

  listActivity: (id) => request(`/api/leads/${id}/activity`),

  listUsers: () => request('/api/users'),
};

export { getToken };
