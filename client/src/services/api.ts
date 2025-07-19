import axios from 'axios';

export const API_BASE_URL = 'http://0.0.0.0:8000/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    
    if(token){
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    
    return config;
},(error) => {
    return Promise.reject(error);
});
