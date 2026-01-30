import AxiosHttpClient from '../infrastructure/http/axios/AxiosHttpClient';

export const http = new AxiosHttpClient({
    baseUrl: import.meta.env.VITE_API_URL + '/api',
    getToken: () => localStorage.getItem('authToken'),
});