import useAnalysisStatusSocketSync from '@/modules/analysis/hooks/use-analysis-status-socket-sync';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useSocketPageLifecycle from '@/modules/socket/hooks/use-socket-page-lifecycle';
import useSocketConnectionToast from '@/modules/socket/hooks/use-socket-connection-toast';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';
import useTeamRoomSubscription from '@/modules/team/hooks/team/use-team-room-subscription';

const ProtectedRouteRealtimeEffects = () => {
    useSocketPageLifecycle();
    useTeamJobs();
    useAnalysisStatusSocketSync();
    useSocketConnectionToast();
    useTeamPresenceSocket();
    useTeamRoomSubscription();
    useTeamActivityHeartbeat();

    return null;
};

export default ProtectedRouteRealtimeEffects;
