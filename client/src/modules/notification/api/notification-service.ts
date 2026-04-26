import { createService, paginated, patch } from '@/app/core/http/utilities/create-service';

import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { ListNotificationsInputDTO } from './dtos/list-notifications';
import type { Notification } from './entities/notification';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const endpoints = {
    getAll: paginated<ListNotificationsInputDTO | undefined, PaginatedResponse<Notification>>('/'),
    markAllAsRead: patch<EmptyParams, void>('/read-status', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/notifications'
        }
    }
}, endpoints);
