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
import { Box, Stack, Row, Text, Heading, Button, Modal, SelectableCard, StatusDot, closeModal, openModal } from '@/shared/presentation/primitives';
import type { StatusDotTone } from '@/shared/presentation/primitives';
import CopyableField from '@/shared/presentation/components/CopyableField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
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
        <Stack align='center' className={`cluster-onboarding-step ${stateClassName} ${className}`} aria-hidden={!isActive} inert={!isActive}>
            {children}
        </Stack>
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
                <Text as='p' size='md' tone='secondary' aria-current='page'>Add new cluster</Text>
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
                <Stack align='center' justify='center' gap='1' className='cluster-onboarding-success-content' role='status' aria-live='polite' aria-atomic='true'>
                    <Heading level={1} weight='bold' className='cluster-onboarding-success-title'>
                        {successMessage}
                    </Heading>
                    <Text as='p' tone='secondary'>
                        Redirecting you to your workspace.
                    </Text>
                </Stack>
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
                <Box className='cluster-onboarding-center'>
                    <OnboardingStepContent step={OnboardingStep.Type} activeStep={step} className='gap-3'>
                        <Stack align='center' gap='1'>
                            <Stack align='center' gap='075'>
                                <Heading level={2} size='3xl' weight='bold' className='cluster-onboarding-title'>
                                    Connect a cluster
                                </Heading>
                            </Stack>
                            <Text as='p' tone='secondary' className='cluster-onboarding-description font-size-2-5'>
                                Clusters provide the compute capacity used to run simulations and analyses in Volt. You can connect more later.
                            </Text>
                        </Stack>

                        <Box className='cluster-onboarding-cards'>
                            <SelectableCard
                                title={<>Use my computer<br />(Useful to start)</>}
                                description='Use your own computer as a cluster.'
                                icon={<HiOutlineComputerDesktop size={20} />}
                                selected={clusterType === ClusterType.Computer}
                                onSelect={() => handleSelectType(ClusterType.Computer)}
                                selectionRole='radio'
                            />
                            <SelectableCard
                                title='I have a server'
                                description='Using a server as a cluster enables smoother collaboration across your team.'
                                icon={<HiOutlineServerStack size={20} />}
                                selected={clusterType === ClusterType.Server}
                                onSelect={() => handleSelectType(ClusterType.Server)}
                                selectionRole='radio'
                            />
                        </Box>
                    </OnboardingStepContent>

                    <OnboardingStepContent step={OnboardingStep.Name} activeStep={step} className='gap-1-5'>
                        <form className='cluster-onboarding-form d-flex column gap-1-5 items-center' onSubmit={handleSubmit}>
                            <Stack align='center' gap='075'>
                                <Heading level={3} size='2xl' weight='bold' className='cluster-onboarding-title'>
                                    Let's name your cluster
                                </Heading>
                            </Stack>

                            <Box className='cluster-onboarding-name-input'>
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
                            </Box>

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
                </Box>

                <Modal
                    id={INSTALL_MODAL_ID}
                    title={`Copy & Paste in your ${targetLabel}`}
                    description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
                >
                    <Stack gap='1' p='1'>
                        <CopyableField
                            value={installCommand}
                            successMessage='Install command copied'
                        />

                        <Row gap='075' className='cluster-onboarding-status-row' role='status' aria-live='polite' aria-atomic='true'>
                            <Row gap='05'>
                                <StatusDot
                                    tone={statusVariant === 'inactive' ? 'neutral' : (statusVariant as StatusDotTone)}
                                    pulse={statusVariant !== 'inactive'}
                                    glow={statusVariant !== 'inactive'}
                                />
                                <Text as='p' size='md' tone='secondary'>
                                    {statusLabel}
                                </Text>
                            </Row>
                        </Row>
                    </Stack>
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
