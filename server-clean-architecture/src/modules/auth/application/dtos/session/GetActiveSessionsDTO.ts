import Session from "../../../domain/entities/Session";
import { UserProps } from "../../../domain/entities/User";

export interface GetActiveSessionsInputDTO{
    userId: string;
};

export interface GetActiveSessionsOutputDTO extends Session{}