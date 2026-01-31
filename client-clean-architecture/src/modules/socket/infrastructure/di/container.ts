import { container } from 'tsyringe';
import SocketService from '../services/SocketService';
import ISocketService from '../../domain/ports/ISocketService';
import SocketIOAdapter from '../adapters/SocketIOAdapter';
import { SOCKET_TOKENS } from './tokens';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import type ITokenStorage from '@/modules/auth/domain/ports/ITokenStorage';

const getInitialAuth = (): Record<string, unknown> => {
    try{
        const tokenStorage = container.resolve<ITokenStorage>(AUTH_TOKENS.TokenStorage);
        const token = tokenStorage.getToken();
        return token ? { token } : {};
    }catch{
        return {};
    }
};

export const ensureSocketDI = (): void => {
    const socketAdapter = new SocketIOAdapter(import.meta.env.VITE_API_URL, {
        auth: getInitialAuth()
    });

    container.registerInstance<ISocketService>(SOCKET_TOKENS.SocketAdapter, socketAdapter);
    container.register<ISocketService>(SOCKET_TOKENS.SocketService, SocketService);
};
