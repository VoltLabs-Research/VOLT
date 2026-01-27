import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import type { TrajectoryJobGroup } from '../../domain/entities/Job';

export interface JobSocketCallbacks {
    onConnectionChange: (connected: boolean) => void;
    onInitialJobs: (groups: TrajectoryJobGroup[]) => void;
    onJobUpdated: (job: any) => void;
    onConnectError?: (error: unknown) => void;
    getCurrentTeamId?: () => string | null;
}

export interface JobSocketSubscriptions {
    offConnection: () => void;
    offInitialJobs: () => void;
    offJobUpdated: () => void;
}

export interface JobSocketInitialization {
    isConnected: boolean;
    subscriptions: JobSocketSubscriptions;
}

export class InitializeJobSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(callbacks: JobSocketCallbacks): JobSocketInitialization {
        const offConnection = this.socketService.onConnectionChange((connected) => {
            callbacks.onConnectionChange(connected);

            if (connected && callbacks.getCurrentTeamId) {
                const teamId = callbacks.getCurrentTeamId();
                if (teamId) {
                    this.socketService.subscribeToTeam(teamId);
                }
            }
        });

        const offInitialJobs = this.socketService.on('team.jobs.initial', (groups: TrajectoryJobGroup[]) => {
            callbacks.onInitialJobs(groups);
        });

        const offJobUpdated = this.socketService.on('team.job.updated', (job: any) => {
            callbacks.onJobUpdated(job);
        });

        if (!this.socketService.isConnected()) {
            this.socketService.connect().catch((error) => {
                callbacks.onConnectError?.(error);
            });
        }

        return {
            isConnected: this.socketService.isConnected(),
            subscriptions: {
                offConnection,
                offInitialJobs,
                offJobUpdated
            }
        };
    }
}
