import type { tags } from 'typia';

export interface GetNotificationsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<20>;
    /**
     * When true, return only notifications that have not been read yet.
     */
    unreadOnly?: boolean;
}
