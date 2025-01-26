import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
});

// Attach the token to all requests if found in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function registerUser(username: string, email: string, password: string) {
  return api.post('/api/auth/register', { username, email, password });
}

export async function loginUser(username: string, password: string) {
  const { data } = await api.post('/api/auth/login', { username, password });
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId);
  }
  return data;
}

export async function getDocuments() {
  const { data } = await api.get('/api/documents');
  return data;
}

export async function getDocumentById(docId: number | string) {
  const { data } = await api.get(`/api/documents/${docId}`);
  return data;
}

export async function createDocument(title: string, content: string) {
  const { data } = await api.post('/api/documents', { title, content });
  return data;
}