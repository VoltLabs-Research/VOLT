import './ClusterOnboardingPage.css';
import Button from '@/shared/presentation/components/Button';
import ClusterListPanel from '@/modules/cluster/components/molecules/ClusterListPanel';
import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import Paragraph from '@/shared/presentation/components/Paragraph';
import TeamSelector from '@/modules/team/components/atoms/TeamSelector';
import Title from '@/shared/presentation/components/Title';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { buildClusterInstallCommand } from '@/modules/cluster/utilities/build-cluster-install-command';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { HiOutlineComputerDesktop, HiOutlineServerStack } from 'react-icons/hi2';
import { sileo } from 'sileo';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

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

const ClusterOnboardingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as ClusterOnboardingLocationState | null;
    const nextDestination = locationState?.next ?? '/dashboard';
    const { clusters, createCluster, deleteCluster } = useClusterManagement();
    const hasConnectedCluster = clusters.some((c) => c.status === TeamClusterStatus.Connected);
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

    // Watch for the created cluster to become connected via real-time socket updates
    const liveCluster = createdCluster
        ? clusters.find((c) => c._id === createdCluster._id) ?? createdCluster
        : null;

    useEffect(() => {
        if (!liveCluster || liveCluster.status !== TeamClusterStatus.Connected) {
            return;
        }

        setConnectedClusterName(liveCluster.name);
        closeModal(INSTALL_MODAL_ID);
        setStep(OnboardingStep.Success);
    }, [liveCluster]);

    // Auto-redirect to dashboard after success
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

    const handleOpenJoinModal = () => openModal('join-team-modal');

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

    // Close install modal if the displayed cluster was deleted
    useEffect(() => {
        if (createdCluster && !clusters.find((c) => c._id === createdCluster._id)) {
            closeModal(INSTALL_MODAL_ID);
            setCreatedCluster(null);
            setEnrollmentToken(null);
        }
    }, [clusters, createdCluster]);

    // Success screen
    if (step === OnboardingStep.Success) {
        return (
            <Container className='cluster-onboarding-success d-flex items-center content-center'>
                <Button
                    className='cluster-onboarding-invite-btn'
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={handleOpenJoinModal}
                >
                    Have an invite code?
                </Button>

                <Title className='cluster-onboarding-success-title font-size-7 font-weight-6 color-primary'>
                    {connectedClusterName} connected!
                </Title>

                <JoinTeamModal />
            </Container>
        );
    }

    const installCommand = createdCluster && enrollmentToken
        ? buildClusterInstallCommand(createdCluster._id, enrollmentToken)
        : '';

    const statusVariant = liveCluster ? getTeamClusterStatusVariant(liveCluster.status) : 'inactive';
    const statusLabel = liveCluster ? getTeamClusterStatusLabel(liveCluster.status) : 'Waiting for connection';
    const targetLabel = clusterType === ClusterType.Computer ? 'Computer' : 'Server';

    return (
        <Container className='cluster-onboarding-page'>
            <Button
                className='cluster-onboarding-invite-btn'
                variant='ghost'
                intent='neutral'
                size='sm'
                onClick={handleOpenJoinModal}
            >
                Have an invite code?
            </Button>
            {hasConnectedCluster ? (
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
            ) : step === OnboardingStep.Name && (
                <Button
                    className='cluster-onboarding-go-back'
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    leftIcon={<ArrowLeft size={16} />}
                    onClick={() => setStep(OnboardingStep.Type)}
                >
                    Go back
                </Button>
            )}

            <Container className='cluster-onboarding-center'>
                {/* Step: type */}
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

                {/* Step: name */}
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
                            inputProps={{ onKeyDown: (e) => { if (e.key === 'Enter') handleSubmitName(); } }}
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

            {/* Install command modal */}
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

            {clusters.length > 0 && (
                <ClusterListPanel
                    clusters={clusters}
                    onDelete={handlePanelDelete}
                />
            )}

            <DeleteClusterModal
                teamCluster={deleteTarget}
                onDelete={handleDeleteCluster}
                onClose={() => setDeleteTarget(null)}
            />

            {/* Floating user menu */}
            <Container className='cluster-onboarding-user-info'>
                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                />
            </Container>

            {/* Floating notifications */}
            <Container className='cluster-onboarding-notifications'>
                <NotificationsPopover />
            </Container>

            <JoinTeamModal />
        </Container>
    );
};

export default ClusterOnboardingPage;
