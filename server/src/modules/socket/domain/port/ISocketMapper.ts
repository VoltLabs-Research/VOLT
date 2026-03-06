import { ISocketConnection } from './ISocketModule';

export interface ISocketMapper{
    toDomain(socket: any): ISocketConnection;
};