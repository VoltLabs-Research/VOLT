export enum OnboardingStep {
    Team = 'team',
    Cluster = 'cluster',
    Done = 'done'
};

interface OnboardingStateInput {
    hasTeam: boolean;
    hasConnectedCluster: boolean;
};

/**
 * Resolves the current onboarding step based on the user's setup state.
 *
 * @param hasTeam - Whether the user has at least one team.
 * @param hasConnectedCluster - Whether the selected team has at least one connected cluster.
 * @returns The onboarding step the user should be on.
 */
export const resolveOnboardingStep = ({ hasTeam, hasConnectedCluster }: OnboardingStateInput): OnboardingStep => {
    if (!hasTeam) return OnboardingStep.Team;
    if (!hasConnectedCluster) return OnboardingStep.Cluster;
    return OnboardingStep.Done;
};
