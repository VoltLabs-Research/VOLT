// Wire response types for the notification module — the shapes the client reads
// back from `data`. `_id`, refs and dates are strings on the wire.

/** A notification as the client sees it. */
export interface PersistedNotification{
    _id: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
}
