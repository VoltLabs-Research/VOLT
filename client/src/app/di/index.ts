import AxiosHttpClient from '../infrastructure/http/axios/AxiosHttpClient';
import TokenStorage from '@/modules/auth/infrastructure/storage/TokenStorage';

export const http = new AxiosHttpClient({
    baseUrl: import.meta.env.VITE_API_URL + '/api',
    getToken: () => new TokenStorage().getToken(),
});