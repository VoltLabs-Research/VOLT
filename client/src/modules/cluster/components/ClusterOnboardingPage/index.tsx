import './ClusterOnboardingPage.css';
import ClusterListPanel from '@/modules/cluster/components/ClusterListPanel';
import ClusterInstallCommandPicker from '@/modules/cluster/components/ClusterInstallCommandPicker';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/DeleteClusterModal';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { resolvePostAuthDestination } from '@/modules/auth/services/post-auth-destination-storage';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { hasUsableTeamCluster } from '@/modules/cluster/utils/is-team-cluster-usable';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import { Button, Modal, closeModal, openModal, StatusDot } from '@voltstack/bravais';
import type { StatusDotTone } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DeleteTeamClusterResponse } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';
import type { FormEvent } from 'react';

enum ClusterOnboardingStep {
    Name = 'name',
    Success = 'success'
}

const INSTALL_MODAL_ID = 'cluster-onboarding-install-modal';
const ENROLLMENT_WAIT_TIMEOUT_MS = 90_000;

const ClusterOnboardingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });
    const { clusters, createCluster, deleteCluster } = useClusterManagement();
    const hasConnectedCluster = hasUsableTeamCluster(clusters);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();
    const [step, setStep] = useState<ClusterOnboardingStep>(ClusterOnboardingStep.Name);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdCluster, setCreatedCluster] = useState<TeamCluster | null>(null);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);
    const [connectedClusterName, setConnectedClusterName] = useState<string | null>(null);
    const [hasWaitTimedOut, setHasWaitTimedOut] = useState(false);
    const [waitNonce, setWaitNonce] = useState(0);
    const hasRedirected = useRef(false);
    const hadConnectedCluster = useRef(hasConnectedCluster);

    const liveCluster = createdCluster
        ? clusters.find((cluster) => cluster._id === createdCluster._id) ?? createdCluster
        : null;
    const isCreatedClusterConnected = clusters.some((cluster) => {
        return cluster._id === createdCluster?._id && cluster.status === TeamClusterStatus.Connected;
    });

    useEffect(() => {
        if (!liveCluster || liveCluster.status !== TeamClusterStatus.Connected) {
            return;
        }

        setConnectedClusterName(liveCluster.name);
        closeModal(INSTALL_MODAL_ID);
        setStep(ClusterOnboardingStep.Success);
    }, [liveCluster]);

    useEffect(() => {
        if (step !== ClusterOnboardingStep.Success || hasRedirected.current) {
            return;
        }

        hasRedirected.current = true;
        const timer = setTimeout(() => {
            navigate(nextDestination, { replace: true });
        }, 2500);

        return () => clearTimeout(timer);
    }, [navigate, nextDestination, step]);

    useEffect(() => {
        const alreadyHadConnectedCluster = hadConnectedCluster.current;
        hadConnectedCluster.current = hasConnectedCluster;

        if (
            alreadyHadConnectedCluster
            || !hasConnectedCluster
            || isCreatedClusterConnected
            || hasRedirected.current
        ) {
            return;
        }

        hasRedirected.current = true;
        navigate(nextDestination, { replace: true });
    }, [hasConnectedCluster, isCreatedClusterConnected, navigate, nextDestination]);

    useEffect(() => {
        if (createdCluster && !clusters.find((cluster) => cluster._id === createdCluster._id)) {
            closeModal(INSTALL_MODAL_ID);
            setCreatedCluster(null);
            setEnrollmentToken(null);
        }
    }, [clusters, createdCluster]);

    const isAwaitingEnrollment = Boolean(createdCluster)
        && Boolean(enrollmentToken)
        && !isCreatedClusterConnected;

    useEffect(() => {
        if (!isAwaitingEnrollment) {
            setHasWaitTimedOut(false);
            return;
        }

        setHasWaitTimedOut(false);
        const timer = window.setTimeout(() => {
            setHasWaitTimedOut(true);
        }, ENROLLMENT_WAIT_TIMEOUT_MS);

        return () => window.clearTimeout(timer);
    }, [isAwaitingEnrollment, waitNonce]);

    const handleRetryWait = () => {
        setHasWaitTimedOut(false);
        setWaitNonce((nonce) => nonce + 1);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!name.trim()) {
            setError('Cluster name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createCluster(name.trim());
            setCreatedCluster(result.teamCluster);
            setEnrollmentToken(result.enrollmentToken);
            openModal(INSTALL_MODAL_ID);
        } catch {
            // Error toast is already shown by showPromise in useClusterManagement
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePanelDelete = (cluster: TeamCluster) => {
        setDeleteTarget(cluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    };

    const handleDeleteCluster = async (password: string): Promise<DeleteTeamClusterResponse> => {
        if (!deleteTarget) {
            throw new Error('No delete target');
        }

        return deleteCluster(deleteTarget._id, password);
    };

    const statusVariant = liveCluster ? getTeamClusterStatusVariant(liveCluster.status) : 'inactive';
    const statusLabel = liveCluster ? getTeamClusterStatusLabel(liveCluster.status) : 'Waiting for connection';
    const successMessage = connectedClusterName ? `${connectedClusterName} connected!` : 'Cluster connected!';

    const leftSlot = hasConnectedCluster ? (
        <nav className='cluster-onboarding-breadcrumb' aria-label='Cluster onboarding breadcrumbs'>
            <Button
                to='/dashboard'
                className='cluster-onboarding-breadcrumb-link text-sm'
                variant='ghost'
                intent='neutral'
                size='sm'
            >
                Dashboard
            </Button>
            <ChevronRight size={14} className='cluster-onboarding-breadcrumb-separator' />
            <p className='text-sm text-muted' aria-current='page'>Add new cluster</p>
        </nav>
    ) : undefined;

    const overlay = clusters.length > 0 ? (
        <ClusterListPanel
            clusters={clusters}
            onDelete={handlePanelDelete}
        />
    ) : null;

    if (step === ClusterOnboardingStep.Success) {
        return (
            <OnboardingLayout
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            >
                <div className='flex flex-col items-center justify-center gap-4 cluster-onboarding-success-content' role='status' aria-live='polite' aria-atomic='true'>
                    <h1 className='text-base font-semibold text-foreground cluster-onboarding-success-title'>
                        {successMessage}
                    </h1>
                    <p className='text-muted'>
                        Redirecting you to your workspace.
                    </p>
                </div>
            </OnboardingLayout>
        );
    }

    return (
        <OnboardingLayout
            leftSlot={leftSlot}
            onSettingsClick={handleSettingsClick}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
            overlay={overlay}
        >
            <>
                <div className='cluster-onboarding-center'>
                    <div className='flex flex-col items-center cluster-onboarding-form-shell gap-6'>
                        <form className='cluster-onboarding-form flex flex-col gap-6 items-center' onSubmit={handleSubmit}>
                            <div className='flex flex-col items-center gap-3'>
                                <h3 className='text-2xl font-semibold text-foreground cluster-onboarding-title'>
                                    Let's name your cluster
                                </h3>
                            </div>

                            <div className='cluster-onboarding-name-input'>
                                <FormFieldRHF
                                    label='Cluster name'
                                    placeholder='e.g., Research Lab Cluster'
                                    value={name}
                                    error={error}
                                    onChange={(event) => {
                                        setName(event.target.value);
                                        if (error) {
                                            setError(undefined);
                                        }
                                    }}
                                />
                            </div>

                            <Button
                                className='cluster-onboarding-continue-btn'
                                variant='solid'
                                intent='brand'
                                size='lg'
                                shape='pill'
                                type='submit'
                                isLoading={isSubmitting}
                            >
                                Continue
                            </Button>
                        </form>
                    </div>
                </div>

                <Modal
                    id={INSTALL_MODAL_ID}
                    title='Copy & Paste on your cluster host'
                    description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
                >
                    <div className='flex flex-col gap-4 p-4'>
                        <ClusterInstallCommandPicker
                            clusterId={createdCluster?._id ?? null}
                            enrollmentToken={enrollmentToken}
                        />

                        {hasWaitTimedOut ? (
                            <RecoveryState
                                tone={RecoveryStateTone.Info}
                                title='Still waiting for your cluster'
                                description='No connection yet. Re-copy the command above and run it on your host. Ensure the daemon is running and outbound WebSocket connections are allowed; this can take 30–60s.'
                                retryLabel='Still waiting / Retry'
                                onRetry={handleRetryWait}
                            />
                        ) : (
                            <div className='flex flex-row items-center gap-3 cluster-onboarding-status-row' role='status' aria-live='polite' aria-atomic='true'>
                                <div className='flex flex-row items-center gap-2'>
                                    <StatusDot
                                        tone={statusVariant === 'inactive' ? 'neutral' : (statusVariant as StatusDotTone)}
                                        pulse={statusVariant !== 'inactive'}
                                        glow={statusVariant !== 'inactive'}
                                    />
                                    <p className='text-sm text-muted'>
                                        {statusLabel}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>

                <DeleteClusterModal
                    teamCluster={deleteTarget}
                    onDelete={handleDeleteCluster}
                    onClose={() => setDeleteTarget(null)}
                />
            </>
        </OnboardingLayout>
    );
};

export default ClusterOnboardingPage;
