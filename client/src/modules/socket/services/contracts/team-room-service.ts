export interface ITeamSocketRoomService {
    subscribe(teamId: string, previousTeamId?: string): Promise<void>;
    unsubscribe(teamId?: string): void;
    getCurrentTeamId(): string | null;
    waitUntilSubscribed(teamId: string): Promise<void>;
};
