import axios from 'axios'
import { supabase } from './supabase'
import type { Me } from '../types'

const api = axios.create({ baseURL: '/api' })

// Attach the signed-in user's access token (refreshed by supabase-js when it expires)
api.interceptors.request.use(async config => {
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) config.headers.Authorization = `Bearer ${data.session.access_token}`
  }
  return config
})

// Session rejected by the server → back to the sign-in screen
api.interceptors.response.use(undefined, async error => {
  if (error.response?.status === 401 && supabase) await supabase.auth.signOut()
  return Promise.reject(error)
})

export const meApi = {
  get: (): Promise<Me> => api.get('/me').then(r => r.data),
}

export const machinesApi = {
  list: () => api.get('/machines').then(r => r.data),
  get: (id: number) => api.get(`/machines/${id}`).then(r => r.data),
  create: (data: any) => api.post('/machines', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/machines/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/machines/${id}`).then(r => r.data),
}

export const materialsApi = {
  list: () => api.get('/materials').then(r => r.data),
  get: (id: number) => api.get(`/materials/${id}`).then(r => r.data),
  create: (data: any) => api.post('/materials', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/materials/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/materials/${id}`).then(r => r.data),
}

export const analysisApi = {
  calculate: (data: any) => api.post('/analysis/calculate', data).then(r => r.data),
  compare: (data: any) => api.post('/analysis/compare', data).then(r => r.data),
}

export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data),
  get: (id: number) => api.get(`/projects/${id}`).then(r => r.data),
  save: (data: any) => api.post('/projects', data).then(r => r.data),
  delete: (id: number) => api.delete(`/projects/${id}`).then(r => r.data),
}

export const aiApi = {
  analyze: (data: any) => api.post('/ai/analyze', data).then(r => r.data),
}

export const exportApi = {
  export: (data: any) => api.post('/export', data, { responseType: 'blob' }).then(r => r),
  exportProject: (id: number, format: 'excel' | 'pdf') =>
    api.get(`/projects/${id}/export`, { params: { format }, responseType: 'blob' }).then(r => r),
}

/** Human-readable message from an API error (FastAPI puts it in `detail`). */
export function apiErrorMessage(e: any, fallback = 'Something went wrong'): string {
  const detail = e?.response?.data?.detail
  return typeof detail === 'string' ? detail : e?.message || fallback
}

export default api
