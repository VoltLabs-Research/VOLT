interface FileDataInput{
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
};

export interface SendFileMessageInputDTO{
    userId: string;
    chatId: string;
    fileData: FileDataInput;
};
