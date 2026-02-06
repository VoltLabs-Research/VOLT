export interface Notification {
    _id: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
};
