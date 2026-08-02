export interface ChatReactionProps{
    emoji: string;
    users: string[];
}

/** Shape produced by the chat upload middleware once the file is in object storage. */
export interface ChatFileUpload{
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
}
