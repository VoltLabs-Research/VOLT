import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { useLocation } from 'react-router-dom';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';

interface AnalysisDiscoveryTourGateParams {
    analyses: Analysis[];
    isAnalysesLoading: boolean;
    isSceneInteractive: boolean;
}

const useAnalysisDiscoveryTourGate = ({
    analyses,
    isAnalysesLoading,
    isSceneInteractive
}: AnalysisDiscoveryTourGateParams) => {
    const location = useLocation();
    const currentUser = useCurrentUser();
    const isAuthInitialized = useAuthStore((state) => state.isInitialized);
    const hasAuthToken = useAuthStore((state) => state.hasToken);

    const cameFromDiscoverTeam = (location.state as { entry?: string } | null)?.entry === 'discover-team';
    const isIdentityReady = isAuthInitialized && (!hasAuthToken || Boolean(currentUser?._id));

    return {
        enabled: isSceneInteractive
            && cameFromDiscoverTeam
            && isIdentityReady
            && !isAnalysesLoading
            && analyses.length > 0,
        storageScopeId: currentUser?._id ?? 'anonymous'
    };
};

export default useAnalysisDiscoveryTourGate;
