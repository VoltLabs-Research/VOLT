export interface ITeamSocketRoomService {
    subscribe(teamId: string, previousTeamId?: string): Promise<void>;
    unsubscribe(teamId?: string): void;
    getCurrentTeamId(): string | null;
}
