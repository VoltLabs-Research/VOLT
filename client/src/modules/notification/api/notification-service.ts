import { createService, paginated, patch } from '@/app/core/http/utils/create-service';

import type { EmptyParams } from '@voltstack/voltclient';
import type { Notification } from '@volt/contracts/modules/notification/domain';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';

export interface ListNotificationsInput {
    page?: number;
    limit?: number;
}

const endpoints = {
    getAll: paginated<ListNotificationsInput | undefined, PaginatedResponse<Notification>>('/'),
    markAllAsRead: patch<EmptyParams, void>('/read-status', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/notifications'
        }
    }
}, endpoints);
