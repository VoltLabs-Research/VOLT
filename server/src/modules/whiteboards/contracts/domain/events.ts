export interface WhiteboardCreatedEventPayload{
    whiteboardId: string;
    teamId: string;
    userId: string;
    whiteboardTitle: string;
}

export interface WhiteboardDeletedEventPayload{
    whiteboardId: string;
    teamId: string;
    userId: string;
    whiteboardTitle: string;
}
