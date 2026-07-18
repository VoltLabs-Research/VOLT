import { UserProps } from '@modules/auth/entities/User';

export interface GetMyAccountInputDTO {
    userId: string;
}

export interface GetMyAccountOutputDTO extends UserProps {
    _id: string;
    fullName: string;
}
