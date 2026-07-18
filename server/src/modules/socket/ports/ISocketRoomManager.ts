export interface PresenceUser {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isAnonymous: boolean;
    [key: string]: unknown;
}
