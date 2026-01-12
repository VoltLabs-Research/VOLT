import { PaginatedResult } from "@/src/shared/domain/IBaseRepository";
import { NotificationProps } from "../../domain/entities/Notification";

export interface GetNotificationsByUserIdInputDTO{
    userId: string;
};

export interface GetNotificationsByUserIdOutputDTO extends PaginatedResult<NotificationProps>{}