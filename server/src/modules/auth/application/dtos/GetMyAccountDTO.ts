import { UserProps } from '@modules/auth/domain/entities/User';

export interface GetMyAccountInputDTO {
    userId: string;
}

export interface GetMyAccountOutputDTO extends UserProps {
    _id: string;
    fullName: string;
}
