export interface ITeamSocketRoomService {
    subscribe(teamId: string, previousTeamId?: string): Promise<void>;
    unsubscribe(teamId?: string): void;
    getCurrentTeamId(): string | null;
    isSubscribed(teamId: string): boolean;
    waitUntilSubscribed(teamId: string): Promise<void>;
};
