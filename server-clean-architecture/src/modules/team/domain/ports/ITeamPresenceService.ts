/**
 * Presence information for a team member.
 */
export interface TeamMemberPresence{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    lastLoginAt?: Date;
};

/**
 * Port interface for team presence tracking service.
 * Handles connection time tracking and activity recording.
 */
export interface ITeamPresenceService{
    /**
     * Record when a user connects to team rooms.
     * @param socketId - Socket identifier
     * @param userId - User identifier
     * @param teamIds - List of team IDs the user belongs to
     */
    recordConnection(
        socketId: string, 
        userId: string, 
        teamIds: string[]
    ): void;

    /**
     * Record when a user disconnects and persist their activity.
     * Calculates time spent online and updates daily activity records.
     * @param socketId - Socket identifier
     */
    recordDisconnection(
        socketId: string
    ): Promise<void>;
};