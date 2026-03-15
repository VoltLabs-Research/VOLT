import './ClusterOnboardingPage.css';
import ClusterListPanel from '@/modules/cluster/components/molecules/ClusterListPanel';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { buildClusterInstallCommand } from '@/modules/cluster/utilities/build-cluster-install-command';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import OnboardingLayout from '@/modules/onboarding/components/templates/OnboardingLayout';
import TeamSelector from '@/modules/team/components/atoms/TeamSelector';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { sileo } from 'sileo';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { HiOutlineComputerDesktop, HiOutlineServerStack } from 'react-icons/hi2';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ReactNode } from 'react';

interface ClusterOnboardingLocationState {
    next?: string;
};

enum ClusterType {
    Computer = 'computer',
    Server = 'server'
}

enum OnboardingStep {
    Type = 'type',
    Name = 'name',
    Success = 'success'
}

const INSTALL_MODAL_ID = 'cluster-onboarding-install-modal';

const isClusterOnboardingLocationState = (state: unknown): state is ClusterOnboardingLocationState => {
    if (!state || typeof state !== 'object') {
        return false;
    }

    const next = Reflect.get(state, 'next');
    return next === undefined || typeof next === 'string';
};

const ClusterOnboardingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = isClusterOnboardingLocationState(location.state) ? location.state : null;
    const nextDestination = locationState?.next ?? '/dashboard';
    const { clusters, createCluster, deleteCluster } = useClusterManagement();
    const hasConnectedCluster = clusters.some((cluster) => cluster.status === TeamClusterStatus.Connected);
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

    const liveCluster = createdCluster
        ? clusters.find((cluster) => cluster._id === createdCluster._id) ?? createdCluster
        : null;

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
            navigate(nextDestination);
        }, 2500);

        return () => clearTimeout(timer);
    }, [navigate, nextDestination, step]);

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

    useEffect(() => {
        if (createdCluster && !clusters.find((cluster) => cluster._id === createdCluster._id)) {
            closeModal(INSTALL_MODAL_ID);
            setCreatedCluster(null);
            setEnrollmentToken(null);
        }
    }, [clusters, createdCluster]);

    const installCommand = createdCluster && enrollmentToken
        ? buildClusterInstallCommand(createdCluster._id, enrollmentToken)
        : '';
    const statusVariant = liveCluster ? getTeamClusterStatusVariant(liveCluster.status) : 'inactive';
    const statusLabel = liveCluster ? getTeamClusterStatusLabel(liveCluster.status) : 'Waiting for connection';
    const targetLabel = clusterType === ClusterType.Computer ? 'Computer' : 'Server';
    const goBackIcon = <ArrowLeft size={16} />;

    let leftSlot: ReactNode | undefined;
    if (hasConnectedCluster) {
        leftSlot = (
            <nav className='cluster-onboarding-breadcrumb' aria-label='Cluster onboarding breadcrumbs'>
                <button
                    type='button'
                    className='cluster-onboarding-breadcrumb-link font-size-2'
                    onClick={() => navigate('/dashboard')}
                >
                    Dashboard
                </button>
                <ChevronRight size={14} className='cluster-onboarding-breadcrumb-separator' />
                <Paragraph className='font-size-2 color-secondary' aria-current='page'>Add new cluster</Paragraph>
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
                <Container className='cluster-onboarding-success-content d-flex column gap-1 items-center content-center'>
                    <Title className='cluster-onboarding-success-title font-size-7 font-weight-6 color-primary'>
                        {connectedClusterName} connected!
                    </Title>
                </Container>
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
                <Container className='cluster-onboarding-center'>
                    <Container className={`cluster-onboarding-step d-flex column gap-3 items-center ${step === OnboardingStep.Type ? 'is-active' : 'exit-left'}`}>
                        <Container className='d-flex column gap-1 items-center'>
                            <TeamSelector className='cluster-onboarding-team-selector' />
                            <Title className='cluster-onboarding-title font-size-6 font-weight-6 color-primary'>
                                Connect a cluster
                            </Title>
                            <Paragraph className='cluster-onboarding-description font-size-2-5 color-secondary'>
                                Clusters provide the compute capacity used to run simulations and analyses in Volt. You can connect more later.
                            </Paragraph>
                        </Container>

                        <Container className='cluster-onboarding-cards'>
                            <button
                                type='button'
                                className='cluster-onboarding-card d-flex column gap-075 items-center'
                                onClick={() => handleSelectType(ClusterType.Computer)}
                            >
                                <Container className='cluster-onboarding-card-icon d-flex items-center content-center'>
                                    <HiOutlineComputerDesktop size={20} />
                                </Container>
                                <Title className='font-size-3 font-weight-6 color-primary'>Use my computer <br/> (Useful to start)</Title>
                                <Paragraph className='font-size-2 color-secondary' style={{ textAlign: 'center' }}>
                                    Use your own computer as a cluster.
                                </Paragraph>
                            </button>

                            <button
                                type='button'
                                className='cluster-onboarding-card d-flex column gap-075 items-center'
                                onClick={() => handleSelectType(ClusterType.Server)}
                            >
                                <Container className='cluster-onboarding-card-icon d-flex items-center content-center'>
                                    <HiOutlineServerStack size={20} />
                                </Container>
                                <Container className='d-flex items-center gap-05'>
                                    <Title className='font-size-3 font-weight-6 color-primary'>I have a server</Title>
                                </Container>
                                <Paragraph className='font-size-2 color-secondary' style={{ textAlign: 'center' }}>
                                    Using a server as a cluster enables smoother collaboration across your team.
                                </Paragraph>
                            </button>
                        </Container>
                    </Container>

                    <Container className={`cluster-onboarding-step d-flex column gap-1-5 items-center ${step === OnboardingStep.Name ? 'is-active' : 'enter-right'}`}>
                        <Title className='cluster-onboarding-title font-size-5 font-weight-6 color-primary'>
                            Let's name your cluster
                        </Title>

                        <Container className='cluster-onboarding-name-input'>
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
                                inputProps={{
                                    onKeyDown: (event) => {
                                        if (event.key === 'Enter') {
                                            handleSubmitName();
                                        }
                                    }
                                }}
                            />
                        </Container>

                        <Button
                            className='cluster-onboarding-continue-btn'
                            variant='solid'
                            intent='brand'
                            size='lg'
                            shape='pill'
                            onClick={handleSubmitName}
                            isLoading={isSubmitting}
                        >
                            Continue
                        </Button>
                    </Container>
                </Container>

                <Modal
                    id={INSTALL_MODAL_ID}
                    title={`Copy & Paste in your ${targetLabel}`}
                    description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
                >
                    <Container className='d-flex column gap-1 p-1'>
                        <CopyableField
                            value={installCommand}
                            successMessage='Install command copied'
                        />

                        <Container className='cluster-onboarding-status-row d-flex items-center gap-075'>
                            <Container className='d-flex items-center gap-05'>
                                <span className={`cluster-onboarding-status-dot variant-${statusVariant}`} />
                                <Paragraph className='font-size-2 color-secondary'>
                                    {statusLabel}
                                </Paragraph>
                            </Container>
                        </Container>
                    </Container>
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
