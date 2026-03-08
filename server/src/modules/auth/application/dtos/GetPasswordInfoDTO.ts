export interface GetPasswordInfoInputDTO {
    userId: string;
};

export interface GetPasswordInfoOutputDTO {
    hasPassword: boolean;
    lastChanged?: string;
};
