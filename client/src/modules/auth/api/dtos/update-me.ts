export interface UpdateAvatarInputDTO {
    avatar: File;
};

export const isUpdateAvatarInputDTO = (data: unknown): data is UpdateAvatarInputDTO => {
    return typeof data === 'object' && data !== null && 'avatar' in data && data.avatar instanceof File;
};

export interface UpdateProfileInputDTO {
    fullName: string;
    email: string;
};
