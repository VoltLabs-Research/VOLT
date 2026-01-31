import VoltClient, { VoltClientOptions } from '@/app/core/http/VoltClient';
import { http } from '@/app/di';

export interface ApiResponse<T>{
    status: string;
    data: T;
};

export interface PaginatedResponse<T>{
    data: T[];
};

export default class BaseRepository{
    protected readonly client: VoltClient;

    constructor(
        basePath: string,
        opts: VoltClientOptions = {}
    ){
        this.client = new VoltClient(http, basePath, opts);
    }

    protected unwrap<T>(response: ApiResponse<T>): T{
        return response.data;
    }
};