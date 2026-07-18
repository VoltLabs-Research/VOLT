export interface NotificationProps {
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Notification {
    readonly _id: string;
    props: NotificationProps;
}

export const createNotification = (_id: string, props: NotificationProps): Notification => ({
    _id,
    props
});

export default Notification;
