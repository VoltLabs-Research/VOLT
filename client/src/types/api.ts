import type { AxiosResponse } from 'axios';
import type { User } from './models';

export interface ApiResponse<T>{
    status: 'success';
    data: T;
}

export interface AuthResponsePayload{
  token: string;
  user: User;
}

export type ApiAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;