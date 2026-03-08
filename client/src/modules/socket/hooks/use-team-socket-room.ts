import { useMemo } from 'react';
import teamSocketRoomService from '../services/team-socket-room-service';
import type { ITeamSocketRoomService } from '../api/entities/socket-service';

const useTeamSocketRoom = (): ITeamSocketRoomService => {
    return useMemo(() => teamSocketRoomService, []);
};

export default useTeamSocketRoom;
