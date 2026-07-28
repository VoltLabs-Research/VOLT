export enum OnboardingStep {
    Team = 'team',
    Cluster = 'cluster',
    Done = 'done'
};

interface OnboardingStateInput {
    hasTeam: boolean;
    hasConnectedCluster: boolean;
};

export const resolveOnboardingStep = ({ hasTeam, hasConnectedCluster }: OnboardingStateInput): OnboardingStep => {
    if (!hasTeam) return OnboardingStep.Team;
    if (!hasConnectedCluster) return OnboardingStep.Cluster;
    return OnboardingStep.Done;
};
