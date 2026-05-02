export interface CreateNotificationInputDTO {
    recipient: string;
    title: string;
    content: string;
    link?: string;
}
