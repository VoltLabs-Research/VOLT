export interface NotificationProps{
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link: string;
    createdAt: Date;
    updatedAt: Date;
};

export default class Notification{
    constructor(
        public id: string,
        public props: NotificationProps
    ){}
};