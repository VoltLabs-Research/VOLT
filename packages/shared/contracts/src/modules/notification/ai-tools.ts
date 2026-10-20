import type { tags } from 'typia';

export interface GetNotificationsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<20>;
    unreadOnly?: boolean;
}
