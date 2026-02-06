export interface CreateNotificationInputDTO {
    recipient: string;
    title: string;
    content: string;
    link: string;
}

export type CreateNotificationOutputDTO = {
    id: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link: string;
    createdAt: Date;
    updatedAt: Date;
};
