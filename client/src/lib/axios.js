import axios from 'axios'

// Centralized axios instance — reads VITE_BASE_URL once from env.
// In development, Vite's proxy forwards /api requests to the backend,
// so baseURL can be left empty (relative URLs work via proxy).
// In production, set VITE_BASE_URL to your deployed backend URL.
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '',
})

export default axiosInstance
