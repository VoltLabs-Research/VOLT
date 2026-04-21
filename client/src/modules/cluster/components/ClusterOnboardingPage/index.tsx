import './ClusterOnboardingPage.css';
import ClusterListPanel from '@/modules/cluster/components/ClusterListPanel';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/DeleteClusterModal';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { resolvePostAuthDestination } from '@/modules/auth/services/post-auth-destination-storage';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { buildClusterInstallCommand } from '@/modules/cluster/utilities/build-cluster-install-command';
import { hasUsableTeamCluster } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import Button from '@/shared/presentation/components/Button';
import CopyableField from '@/shared/presentation/components/CopyableField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { sileo } from 'sileo';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { HiOutlineComputerDesktop, HiOutlineServerStack } from 'react-icons/hi2';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { FormEvent, ReactNode } from 'react';

enum ClusterType {
    Computer = 'computer',
    Server = 'server'
}

enum OnboardingStep {
    Type = 'type',
    Name = 'name',
    Success = 'success'
}

interface OnboardingStepContentProps {
    step: OnboardingStep;
    activeStep: OnboardingStep;
    children: ReactNode;
    className: string;
};

const INSTALL_MODAL_ID = 'cluster-onboarding-install-modal';

const OnboardingStepContent = ({
    step,
    activeStep,
    children,
    className
}: OnboardingStepContentProps) => {
    const isActive = step === activeStep;
    const stateClassName = isActive
        ? 'is-active'
        : step === OnboardingStep.Type
            ? 'exit-left'
            : 'enter-right';

    return (
        <div className={`volt-container cluster-onboarding-step d-flex column items-center ${stateClassName} ${className}`} aria-hidden={!isActive} inert={!isActive}>
            {children}
        </div>
    );
};

const ClusterOnboardingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const nextDestination = resolvePostAuthDestination({
        queryNext: new URLSearchParams(location.search).get('next')
    });
    const { clusters, createCluster, deleteCluster } = useClusterManagement();
    const hasConnectedCluster = hasUsableTeamCluster(clusters);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [step, setStep] = useState<OnboardingStep>(OnboardingStep.Type);
    const [clusterType, setClusterType] = useState<ClusterType | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdCluster, setCreatedCluster] = useState<TeamCluster | null>(null);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);
    const [connectedClusterName, setConnectedClusterName] = useState<string | null>(null);
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
        setStep(OnboardingStep.Success);
    }, [liveCluster]);

    useEffect(() => {
        if (step !== OnboardingStep.Success || hasRedirected.current) {
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

    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch {
            sileo.error({ title: 'Sign out failed', description: 'Please try again.' });
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleSettingsClick = () => {
        navigate('/dashboard/settings/general');
    };

    const handleSelectType = (type: ClusterType) => {
        setClusterType(type);
        setStep(OnboardingStep.Name);
    };

    const handleSubmitName = async () => {
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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await handleSubmitName();
    };

    const handlePanelDelete = (cluster: TeamCluster) => {
        setDeleteTarget(cluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    };

    const handleDeleteCluster = async (password: string): Promise<DeleteTeamClusterOutputDTO> => {
        if (!deleteTarget) {
            throw new Error('No delete target');
        }

        return deleteCluster(deleteTarget._id, password);
    };

    const installCommand = createdCluster && enrollmentToken
        ? buildClusterInstallCommand(createdCluster._id, enrollmentToken)
        : '';
    const statusVariant = liveCluster ? getTeamClusterStatusVariant(liveCluster.status) : 'inactive';
    const statusLabel = liveCluster ? getTeamClusterStatusLabel(liveCluster.status) : 'Waiting for connection';
    const targetLabel = clusterType === ClusterType.Computer ? 'Computer' : 'Server';
    const successMessage = connectedClusterName ? `${connectedClusterName} connected!` : 'Cluster connected!';
    const goBackIcon = <ArrowLeft size={16} />;

    let leftSlot: ReactNode | undefined;
    if (hasConnectedCluster) {
        leftSlot = (
            <nav className='cluster-onboarding-breadcrumb' aria-label='Cluster onboarding breadcrumbs'>
                <Button
                    to='/dashboard'
                    className='cluster-onboarding-breadcrumb-link font-size-2'
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                >
                    Dashboard
                </Button>
                <ChevronRight size={14} className='cluster-onboarding-breadcrumb-separator' />
                <p className='volt-text font-size-2 color-secondary' aria-current='page'>Add new cluster</p>
            </nav>
        );
    }

    if (!hasConnectedCluster && step === OnboardingStep.Name) {
        leftSlot = (
            <Button
                className='cluster-onboarding-go-back'
                variant='ghost'
                intent='neutral'
                size='sm'
                leftIcon={goBackIcon}
                onClick={() => setStep(OnboardingStep.Type)}
            >
                Go back
            </Button>
        );
    }

    const overlay = clusters.length > 0 ? (
        <ClusterListPanel
            clusters={clusters}
            onDelete={handlePanelDelete}
        />
    ) : null;

    if (step === OnboardingStep.Success) {
        return (
            <OnboardingLayout
                onSettingsClick={handleSettingsClick}
                onSignOut={handleSignOut}
                isSigningOut={isSigningOut}
            >
                <div className='volt-container cluster-onboarding-success-content d-flex column gap-1 items-center content-center' role='status' aria-live='polite' aria-atomic='true'>
                    <h1 className='volt-title cluster-onboarding-success-title font-weight-6 color-primary'>
                        {successMessage}
                    </h1>
                    <p className='volt-text color-secondary'>
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
                <div className='volt-container cluster-onboarding-center'>
                    <OnboardingStepContent step={OnboardingStep.Type} activeStep={step} className='gap-3'>
                        <div className='volt-container d-flex column gap-1 items-center'>
                            <div className='volt-container d-flex column gap-075 items-center'>
                                <h2 className='volt-title cluster-onboarding-title font-size-6 font-weight-6 color-primary'>
                                    Connect a cluster
                                </h2>
                            </div>
                            <p className='volt-text cluster-onboarding-description font-size-2-5 color-secondary'>
                                Clusters provide the compute capacity used to run simulations and analyses in Volt. You can connect more later.
                            </p>
                        </div>

                        <div className='volt-container cluster-onboarding-cards'>
                            <button
                                type='button'
                                className='cluster-onboarding-card d-flex column gap-075 items-center'
                                onClick={() => handleSelectType(ClusterType.Computer)}
                            >
                                <div className='volt-container cluster-onboarding-card-icon d-flex items-center content-center'>
                                    <HiOutlineComputerDesktop size={20} />
                                </div>
                                <h3 className='volt-title font-size-3 font-weight-6 color-primary'>
                                    Use my computer
                                    <br />
                                    (Useful to start)
                                </h3>
                                <p className='volt-text font-size-2 color-secondary cluster-onboarding-card-copy'>
                                    Use your own computer as a cluster.
                                </p>
                            </button>

                            <button
                                type='button'
                                className='cluster-onboarding-card d-flex column gap-075 items-center'
                                onClick={() => handleSelectType(ClusterType.Server)}
                            >
                                <div className='volt-container cluster-onboarding-card-icon d-flex items-center content-center'>
                                    <HiOutlineServerStack size={20} />
                                </div>
                                <div className='volt-container d-flex items-center gap-05'>
                                    <h3 className='volt-title font-size-3 font-weight-6 color-primary'>I have a server</h3>
                                </div>
                                <p className='volt-text font-size-2 color-secondary cluster-onboarding-card-copy'>
                                    Using a server as a cluster enables smoother collaboration across your team.
                                </p>
                            </button>
                        </div>
                    </OnboardingStepContent>

                    <OnboardingStepContent step={OnboardingStep.Name} activeStep={step} className='gap-1-5'>
                        <form className='cluster-onboarding-form d-flex column gap-1-5 items-center' onSubmit={handleSubmit}>
                            <div className='volt-container d-flex column gap-075 items-center'>
                                <h3 className='volt-title cluster-onboarding-title font-size-5 font-weight-6 color-primary'>
                                    Let's name your cluster
                                </h3>
                            </div>

                            <div className='volt-container cluster-onboarding-name-input'>
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
                    </OnboardingStepContent>
                </div>

                <Modal
                    id={INSTALL_MODAL_ID}
                    title={`Copy & Paste in your ${targetLabel}`}
                    description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
                >
                    <div className='volt-container d-flex column gap-1 p-1'>
                        <CopyableField
                            value={installCommand}
                            successMessage='Install command copied'
                        />

                        <div className='volt-container cluster-onboarding-status-row d-flex items-center gap-075' role='status' aria-live='polite' aria-atomic='true'>
                            <div className='volt-container d-flex items-center gap-05'>
                                <span className={`cluster-onboarding-status-dot variant-${statusVariant}`} />
                                <p className='volt-text font-size-2 color-secondary'>
                                    {statusLabel}
                                </p>
                            </div>
                        </div>
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
