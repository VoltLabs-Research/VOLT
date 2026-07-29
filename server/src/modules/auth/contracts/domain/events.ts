export interface UserCreatedEventPayload{
    id: string;
    firstName: string;
}

export interface UserDeletedEventPayload{
    userId: string;
}
