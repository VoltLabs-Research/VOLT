import { useAvailableClusterVersionsQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import Title from '@/shared/presentation/components/Title';
import { useState } from 'react';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { AvailableClusterVersion } from '@/modules/cluster/api/dtos/team-cluster/fetch-available-cluster-versions';
import type { RequestClusterUpdateOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const UPDATE_CLUSTER_MODAL_ID = 'update-cluster-modal';

type UpdateStep = 'select' | 'confirm';

interface UpdateClusterModalProps {
    teamCluster: TeamCluster | null;
    teamId: string | null;
    onUpdate: (targetVersion: string, isEdge: boolean, password: string) => Promise<RequestClusterUpdateOutputDTO>;
    onClose: () => void;
};

const buildVersionLabel = (version: AvailableClusterVersion): string => {
    if (version.isEdge) {
        return 'Edge build (main) - latest commit, may be unstable';
    }

    let label = version.tag;
    if (version.isLatest) {
        label += ' (latest)';
    }
    return label;
};

const UpdateClusterModal = ({ teamCluster, teamId, onUpdate, onClose }: UpdateClusterModalProps) => {
    const [step, setStep] = useState<UpdateStep>('select');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const clusterId = teamCluster?._id ?? '';
    const enabled = Boolean(teamId && clusterId);

    const versionsQuery = useAvailableClusterVersionsQuery(teamId ?? '', clusterId, { enabled });

    const versions = versionsQuery.data?.versions ?? [];

    const selectOptions = versions.map((version) => ({
        value: version.tag,
        title: buildVersionLabel(version)
    }));

    const selectedVersion = versions.find((v) => v.tag === selectedTag) ?? null;

    const handleClose = () => {
        setStep('select');
        setSelectedTag(null);
        setPassword('');
        setError(undefined);
        closeModal(UPDATE_CLUSTER_MODAL_ID);
        onClose();
    };

    const handleContinue = () => {
        if (!selectedTag) {
            setError('Please select a target version');
            return;
        }

        setError(undefined);
        setStep('confirm');
    };

    const handleBack = () => {
        setStep('select');
        setPassword('');
        setError(undefined);
    };

    const handleSubmit = async () => {
        if (!password.trim()) {
            setError('Password confirmation is required');
            return;
        }

        if (!selectedVersion) {
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onUpdate(selectedVersion.tag, selectedVersion.isEdge, password);
            handleClose();
        } catch (err: unknown) {
            setError(reportError(err, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Update request failed'
            }).title);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderSelectStep = () => {
        if (versionsQuery.isLoading) {
            return (
                <Container className='d-flex flex-center p-2'>
                    <Loader scale={0.5} isFixed={false} />
                </Container>
            );
        }

        if (versionsQuery.isError && !versions.length) {
            return (
                <Container className='d-flex column gap-1'>
                    <Paragraph className='font-size-2 color-danger'>
                        Failed to load available versions. You can still proceed with an edge build.
                    </Paragraph>
                </Container>
            );
        }

        const isRetry = teamCluster?.status === TeamClusterStatus.UpdateFailed;

        return (
            <Container className='d-flex column gap-1'>
                {isRetry && (
                    <Container className='p-1 radius-md bg-page'>
                        <Paragraph className='font-size-2 color-danger'>
                            ⚠ The previous update attempt failed. Select a version and retry.
                            If the issue persists, check the host logs.
                        </Paragraph>
                    </Container>
                )}
                {teamCluster?.installedVersion && (
                    <Paragraph className='font-size-2 color-secondary'>
                        Current version: <strong>{teamCluster.installedVersion}</strong>
                    </Paragraph>
                )}
                <Select
                    options={selectOptions}
                    value={selectedTag}
                    onChange={setSelectedTag}
                    placeholder='Select a target version...'
                    disabled={versionsQuery.isLoading}
                />
                {selectedVersion?.isEdge && (
                    <Container className='p-1 radius-md bg-page'>
                        <Paragraph className='font-size-2 color-warning'>
                            ⚠ Edge builds include unreleased changes and may be less stable than tagged releases.
                            Only use this if you need the latest fixes or features.
                        </Paragraph>
                    </Container>
                )}
                {error && (
                    <Paragraph className='font-size-2 color-danger'>{error}</Paragraph>
                )}
            </Container>
        );
    };

    const renderConfirmStep = () => (
        <Container className='d-flex column gap-1'>
            <Paragraph className='font-size-2 color-secondary'>
                The cluster daemon will restart and pull{' '}
                <strong>{selectedVersion?.isEdge ? 'the latest edge build (main)' : selectedVersion?.tag}</strong>.
                Ongoing jobs may be interrupted during the update.
            </Paragraph>
            <FormFieldRHF
                label='Password'
                type='password'
                value={password}
                error={error}
                onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) {
                        setError(undefined);
                    }
                }}
            />
        </Container>
    );

    const primaryLabel = step === 'select' ? 'Continue' : 'Update cluster';
    const secondaryLabel = step === 'select' ? 'Cancel' : 'Back';

    const handleSecondaryClick = step === 'select' ? handleClose : handleBack;
    const handlePrimaryClick = step === 'select' ? handleContinue : handleSubmit;

    const title = step === 'confirm' && selectedVersion
        ? `Confirm update to ${selectedVersion.isEdge ? 'edge (main)' : selectedVersion.tag}`
        : `Update ${teamCluster?.name ?? 'cluster'}`;

    return (
        <Modal
            id={UPDATE_CLUSTER_MODAL_ID}
            title={title}
            description='Choose a target version and confirm with your password to apply the update.'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: secondaryLabel,
                        onClick: handleSecondaryClick,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: primaryLabel,
                        intent: step === 'confirm' ? 'brand' : 'neutral',
                        onClick: handlePrimaryClick,
                        isLoading: isSubmitting
                    }}
                />
            )}
            onClose={handleClose}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <Title className='font-size-2 font-weight-5 color-secondary'>
                    {step === 'select' ? 'Select target version' : 'Confirm password'}
                </Title>
                {step === 'select' ? renderSelectStep() : renderConfirmStep()}
            </Container>
        </Modal>
    );
};

export default UpdateClusterModal;
