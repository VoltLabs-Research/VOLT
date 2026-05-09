import { createService, paginated, patch } from '@/app/core/http/utilities/create-service';

import type { EmptyParams } from '@voltstack/voltclient';
import type { Notification } from './entities/notification';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

export interface ListNotificationsInputDTO {
    page?: number;
    limit?: number;
}

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
