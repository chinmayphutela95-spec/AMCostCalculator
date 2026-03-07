import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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

export const geometryApi = {
  parse: (file: File, buildDirection: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('build_direction', buildDirection)
    return api.post('/geometry/parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
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

export const settingsApi = {
  get: () => api.get('/settings').then(r => r.data),
  set: (key: string, value: string) => api.post('/settings', { key, value }).then(r => r.data),
}

export const exportApi = {
  export: (data: any) => api.post('/export', data, { responseType: 'blob' }).then(r => r),
}

export default api
