import { Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';

/**
 * Handles per-trajectory subscriptions rooms.
 */
class TrajectoryModule extends BaseSocketModule{
    constructor(){
        super('TrajectoryModule');
    }

    onConnection(socket: Socket): void{
        socket.on('subscribe_to_trajectory', ({ teamId, trajectoryId, user, previousTrajectoryId }) => {
            if(previousTrajectoryId){
                this.leaveRoom(socket, `${teamId}-${previousTrajectoryId}`);
            }

            if(teamId && trajectoryId){
                this.joinRoom(socket, `${teamId}-${trajectoryId}`);
                console.log(`[Trajectory] Socket ${socket.id} user:`, user);
            }
        });
    }
}

export default TrajectoryModule;