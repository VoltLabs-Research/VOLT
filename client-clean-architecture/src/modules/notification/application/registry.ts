import type { INotificationRepository } from '../domain/repositories/INotificationRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import { InitializeNotificationSocketUseCase } from './use-cases';

export interface NotificationDependencies {
    notificationRepository: INotificationRepository;
    socketService: ISocketService;
}

export interface NotificationUseCases {
    initializeNotificationSocketUseCase: InitializeNotificationSocketUseCase;
}

let dependencies: NotificationDependencies | null = null;
let useCases: NotificationUseCases | null = null;

const buildUseCases = (deps: NotificationDependencies): NotificationUseCases => ({
    initializeNotificationSocketUseCase: new InitializeNotificationSocketUseCase(deps.socketService)
});

export const registerNotificationDependencies = (deps: NotificationDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getNotificationUseCases = (): NotificationUseCases => {
    if (!dependencies) {
        throw new Error('Notification dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
