import useAnalysisStatusSocketSync from '@/modules/analysis/hooks/use-analysis-status-socket-sync';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useSocketConnectionToast from '@/modules/socket/hooks/use-socket-connection-toast';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';

const ProtectedRouteRealtimeEffects = () => {
    useTeamJobs();
    useAnalysisStatusSocketSync();
    useSocketConnectionToast();
    useTeamPresenceSocket();
    useTeamActivityHeartbeat();

    return null;
};

export default ProtectedRouteRealtimeEffects;
