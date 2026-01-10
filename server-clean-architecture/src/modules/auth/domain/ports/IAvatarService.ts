export interface AvatarResult{
    buffer: Buffer;
    mimeType: string;
    extension: string;
};

export interface IAvatarService{
    generateIdenticon(
        seed: string
    ): AvatarResult;

    generateAndUploadDefaultAvatar(
        id: string,
        seed: string
    ): Promise<string>;

    uploadCustomAvatar(
        id: string,
        inputBuffer: Buffer
    ): Promise<string>;
};