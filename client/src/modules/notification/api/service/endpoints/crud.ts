import { paginated, patch, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { Notification } from '../../entities/notification';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const endpoints = {
    getAll: paginated<{ page?: number; limit?: number } | undefined, PaginatedResponse<Notification>>('/'),
    markAllAsRead: patch<EmptyParams, void>('/read-all', { unwrap: 'void' })
};

export default endpoints;
