import { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/contracts/modal-ids';
import ClusterListPanel from '@/modules/cluster/components/ClusterListPanel';
import ClusterInstallCommandPicker from '@/modules/cluster/components/ClusterInstallCommandPicker';
import DeleteClusterModal from '@/modules/cluster/components/DeleteClusterModal';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { resolvePostAuthDestination } from '@/modules/auth/services/post-auth-destination-storage';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { hasUsableTeamCluster } from '@/modules/cluster/utils/is-team-cluster-usable';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import ClusterStatusDot from '@/modules/cluster/components/shared/ClusterStatusDot';
import { Button, buttonVariants } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal, openModal, useModalPayload } from '@/shared/ui/modal/use-modal-store';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
    const [connectedClusterName, setConnectedClusterName] = useState<string | null>(null);
    const deleteTarget = useModalPayload<TeamCluster>(DELETE_CLUSTER_MODAL_ID);
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePanelDelete = (cluster: TeamCluster) => {
        openModal(DELETE_CLUSTER_MODAL_ID, cluster);
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
        <nav className='flex items-center gap-1' aria-label='Cluster onboarding breadcrumbs'>
            <Link
                to='/dashboard'
                className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'px-0 text-sm'
                })}
            >
                Dashboard
            </Link>
            <ChevronRight size={14} className='shrink-0 text-muted' />
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
                <div className='flex flex-col items-center justify-center gap-4 h-full min-h-0' role='status' aria-live='polite' aria-atomic='true'>
                    <h1 className='text-center text-[clamp(2.25rem,5vw,3rem)] font-semibold text-foreground animate-in fade-in-0 slide-in-from-bottom-3 duration-400 ease-out'>
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
                <div className='relative flex items-center justify-center w-[min(100%,560px)] h-full min-h-0 max-h-full px-4 py-8 max-md:px-0 max-md:pt-4 max-md:pb-0'>
                    <div className='flex flex-col items-center w-full gap-6'>
                        <form className='w-full flex flex-col gap-6 items-center' onSubmit={handleSubmit}>
                            <div className='flex flex-col items-center gap-3'>
                                <h3 className='text-2xl font-semibold text-foreground text-center'>
                                    Let's name your cluster
                                </h3>
                            </div>
                            <div className='w-full'>
                                <FormFieldRHF
                                    label='Cluster name'
                                    className='rounded-full'
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
                                className='min-w-[200px] rounded-full max-sm:w-full max-sm:min-w-0'
                                variant='primary'
                                size='lg'
                                type='submit'
                                isPending={isSubmitting}
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

                            <div className='flex flex-row items-center flex-wrap gap-x-3 gap-y-2' role='status' aria-live='polite' aria-atomic='true'>
                                <div className='flex flex-row items-center gap-2'>
                                    <ClusterStatusDot
                                        tone={statusVariant === 'inactive' ? 'neutral' : statusVariant}
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
                />
            </>
        </OnboardingLayout>
    );
};

export default ClusterOnboardingPage;
