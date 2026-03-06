import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { Settings2, Trash2 } from 'lucide-react';
import { Skeleton } from '@mui/material';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import SettingsPage from '../SettingsPage';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useListTeamAIIntegrations from '@/modules/team/presentation/hooks/ai-integration/use-list-team-ai-integrations';
import useListTeamAIIntegrationModels from '@/modules/team/presentation/hooks/ai-integration/use-list-team-ai-integration-models';
import useCreateTeamAIIntegration from '@/modules/team/presentation/hooks/ai-integration/use-create-team-ai-integration';
import useUpdateTeamAIIntegration from '@/modules/team/presentation/hooks/ai-integration/use-update-team-ai-integration';
import useDeleteTeamAIIntegration from '@/modules/team/presentation/hooks/ai-integration/use-delete-team-ai-integration';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import type {
    TeamAIIntegration,
    TeamAIModelMetadata,
    TeamAIProvider,
    TeamAIProviderModelsCatalog
} from '@/modules/team/domain/entities/TeamAIIntegration';
import { AI_PROVIDER_CATALOG } from '@/modules/ai/domain/constants/AIProviders';
import type { CreateTeamAIIntegrationParams, UpdateTeamAIIntegrationParams } from '@/modules/team/domain/port/ITeamAIIntegrationRepository';
import './IntegrationsSettings.css';

const TEAM_AI_INTEGRATION_MODAL_ID = 'team-ai-integration-modal';
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

const resolveOllamaBaseUrl = (metadata?: Record<string, unknown>): string => {
    if (typeof metadata?.baseUrl === 'string') {
        return metadata.baseUrl;
    }
    return OLLAMA_DEFAULT_BASE_URL;
};

const IntegrationsSettings: React.FC = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const listTeamAIIntegrations = useListTeamAIIntegrations();
    const listTeamAIIntegrationModels = useListTeamAIIntegrationModels();
    const createTeamAIIntegration = useCreateTeamAIIntegration();
    const updateTeamAIIntegration = useUpdateTeamAIIntegration();
    const deleteTeamAIIntegration = useDeleteTeamAIIntegration();
    const socket = useSocket();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [busyProvider, setBusyProvider] = useState<TeamAIProvider | null>(null);
    const [integrations, setIntegrations] = useState<TeamAIIntegration[]>([]);
    const [providerModels, setProviderModels] = useState<TeamAIProviderModelsCatalog[]>([]);

    const [editingProvider, setEditingProvider] = useState<TeamAIProvider | null>(null);
    const [modalProvider, setModalProvider] = useState<TeamAIProvider | null>(null);
    const [modalApiKey, setModalApiKey] = useState('');
    const [modalEndpoint, setModalEndpoint] = useState(OLLAMA_DEFAULT_BASE_URL);
    const [modalDefaultModel, setModalDefaultModel] = useState<string | null>(null);
    const [modalEnabledModels, setModalEnabledModels] = useState<Set<string>>(new Set());
    const [modalEnabled, setModalEnabled] = useState(true);

    const integrationsByProvider = useMemo(() => {
        return new Map(integrations.map((integration) => [integration.provider, integration]));
    }, [integrations]);

    const modelsByProvider = useMemo(() => {
        return new Map(providerModels.map((provider) => [provider.provider, provider]));
    }, [providerModels]);

    const configuredIntegrations = useMemo(() => {
        return integrations.filter((integration) => integration.hasApiKey);
    }, [integrations]);

    const availableProviders = useMemo(() => {
        return AI_PROVIDER_CATALOG.filter((provider) => {
            const integration = integrationsByProvider.get(provider.id);
            return !integration?.hasApiKey;
        });
    }, [integrationsByProvider]);

    const providerSelectOptions: SelectOption[] = useMemo(() => (
        availableProviders.map((provider) => ({
            value: provider.id,
            title: provider.name,
            description: provider.description
        }))
    ), [availableProviders]);

    const allModalModels: TeamAIModelMetadata[] = useMemo(() => {
        if (!modalProvider) {
            return [];
        }
        return modelsByProvider.get(modalProvider)?.models || [];
    }, [modalProvider, modelsByProvider]);

    const modalModelOptions: SelectOption[] = useMemo(() => {
        const models = modalEnabledModels.size > 0
            ? allModalModels.filter((m) => modalEnabledModels.has(m.id))
            : allModalModels;

        return models.map((model) => ({
            value: model.id,
            title: model.name,
            description: model.description
        }));
    }, [allModalModels, modalEnabledModels]);

    const resolveDefaultModel = useCallback((provider: TeamAIProvider): string | null => {
        const catalog = modelsByProvider.get(provider);
        if (!catalog) {
            return null;
        }

        return catalog.defaultModel || null;
    }, [modelsByProvider]);

    const refreshData = useCallback(async () => {
        if (!selectedTeam?._id) {
            setIntegrations([]);
            setProviderModels([]);
            return;
        }

        setIsLoading(true);
        try {
            const [integrationsResponse, modelsResponse] = await Promise.all([
                listTeamAIIntegrations(),
                listTeamAIIntegrationModels()
            ]);
            setIntegrations(integrationsResponse.integrations);
            setProviderModels(modelsResponse.providers);
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                sileo.error({ title: msg });
            } else {
                sileo.error({ title: 'Failed to load integrations' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [listTeamAIIntegrationModels, listTeamAIIntegrations, selectedTeam?._id]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (!selectedTeam?._id) {
            return;
        }

        const handleSync = (...args: unknown[]) => {
            const payload = args[0] as { teamId?: string } | undefined;
            if (payload?.teamId === selectedTeam._id) {
                refreshData();
            }
        };

        const unsubscribers = [
            socket.on('team-ai-integration.created', handleSync),
            socket.on('team-ai-integration.updated', handleSync),
            socket.on('team-ai-integration.deleted', handleSync)
        ];

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [refreshData, selectedTeam?._id, socket]);

    const resetModalState = () => {
        setEditingProvider(null);
        setModalProvider(null);
        setModalApiKey('');
        setModalEndpoint(OLLAMA_DEFAULT_BASE_URL);
        setModalDefaultModel(null);
        setModalEnabledModels(new Set());
        setModalEnabled(true);
    };

    const openCreateProviderModal = () => {
        if (!selectedTeam?._id) {
            return;
        }

        const firstProvider = availableProviders[0]?.id;
        if (!firstProvider) {
            sileo.info({ title: 'All providers are already configured' });
            return;
        }

        setEditingProvider(null);
        setModalProvider(firstProvider);
        setModalApiKey('');
        setModalEndpoint(OLLAMA_DEFAULT_BASE_URL);
        setModalEnabled(true);
        setModalEnabledModels(new Set());
        setModalDefaultModel(resolveDefaultModel(firstProvider));
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    const openEditProviderModal = (integration: TeamAIIntegration) => {
        const ollamaBaseUrl = integration.provider === 'ollama'
            ? resolveOllamaBaseUrl(integration.metadata)
            : OLLAMA_DEFAULT_BASE_URL;

        setEditingProvider(integration.provider);
        setModalProvider(integration.provider);
        setModalApiKey('');
        setModalEndpoint(ollamaBaseUrl);
        setModalEnabled(integration.isEnabled);
        setModalEnabledModels(new Set(integration.enabledModels || []));
        setModalDefaultModel(integration.defaultModel || resolveDefaultModel(integration.provider));
        openModal(TEAM_AI_INTEGRATION_MODAL_ID);
    };

    const handleModalProviderChange = (provider: string) => {
        const nextProvider = provider as TeamAIProvider;
        const nextIntegration = integrationsByProvider.get(nextProvider);
        const ollamaBaseUrl = nextProvider === 'ollama'
            ? resolveOllamaBaseUrl(nextIntegration?.metadata)
            : OLLAMA_DEFAULT_BASE_URL;

        setModalProvider(nextProvider);
        setModalEndpoint(ollamaBaseUrl);
        setModalEnabledModels(new Set());
        setModalDefaultModel(resolveDefaultModel(nextProvider));
    };

    const handleToggleModel = (modelId: string) => {
        setModalEnabledModels((prev) => {
            const next = new Set(prev);
            if (next.has(modelId)) {
                next.delete(modelId);
            } else {
                next.add(modelId);
            }
            return next;
        });
    };

    // When enabled models change, ensure the default model is still valid
    useEffect(() => {
        if (modalEnabledModels.size > 0 && modalDefaultModel && !modalEnabledModels.has(modalDefaultModel)) {
            setModalDefaultModel(modalEnabledModels.values().next().value ?? null);
        }
    }, [modalEnabledModels, modalDefaultModel]);

    const handleSaveIntegration = async () => {
        if (!modalProvider) {
            sileo.error({ title: 'Choose a provider' });
            return;
        }

        const integration = integrationsByProvider.get(modalProvider);
        const apiKey = modalApiKey.trim();
        if (!integration && modalProvider !== 'ollama' && !apiKey) {
            sileo.error({ title: 'API key is required for new providers' });
            return;
        }
        if (modalProvider === 'ollama' && !modalEndpoint.trim()) {
            sileo.error({ title: 'Endpoint URL is required for Ollama' });
            return;
        }

        const payload: CreateTeamAIIntegrationParams | UpdateTeamAIIntegrationParams = {
            isEnabled: modalEnabled,
            defaultModel: modalDefaultModel || undefined,
            enabledModels: [...modalEnabledModels]
        };

        if (apiKey) {
            payload.apiKey = apiKey;
        }

        if (modalProvider === 'ollama') {
            payload.metadata = {
                baseUrl: modalEndpoint.trim()
            };
        }

        setIsSaving(true);
        try {
            const action = integration
                ? updateTeamAIIntegration(modalProvider, payload)
                : createTeamAIIntegration(modalProvider, payload);
            await showPromise(
                action,
                {
                    loading: { title: integration ? 'Updating provider...' : 'Creating provider...' },
                    success: { title: integration ? 'Provider configuration updated' : 'Provider configuration created' },
                    error: { title: integration ? 'Failed to update provider' : 'Failed to create provider' }
                }
            );
            closeModal(TEAM_AI_INTEGRATION_MODAL_ID);
            resetModalState();
            await refreshData();
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveProvider = async (provider: TeamAIProvider) => {
        const integration = integrationsByProvider.get(provider);
        if (!integration) {
            return;
        }

        if (!window.confirm(`Remove ${integration.providerName} from this team?`)) {
            return;
        }

        setBusyProvider(provider);
        try {
            await showPromise(
                deleteTeamAIIntegration(provider),
                {
                    loading: { title: `Removing ${integration.providerName}...` },
                    success: { title: `${integration.providerName} removed` },
                    error: { title: 'Failed to remove provider' }
                }
            );
            await refreshData();
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        } finally {
            setBusyProvider(null);
        }
    };

    const canAddProvider = Boolean(selectedTeam?._id && availableProviders.length > 0);

    return (
        <SettingsPage title='Integrations'>
            <SettingsSection>
                <SettingsSectionHeader
                    title='AI Providers'
                    description='Manage API keys and models shared across your team.'
                    action={(
                        <Button
                            size='sm'
                            variant='solid'
                            intent='white'
                            className='radius-full'
                            leftIcon={<IoAddOutline size={14} />}
                            onClick={openCreateProviderModal}
                            disabled={!canAddProvider}
                        >
                            Connect
                        </Button>
                    )}
                />

                {!selectedTeam?._id ? (
                    <Paragraph className='font-size-2 color-muted'>
                        Select a team to manage integrations.
                    </Paragraph>
                ) : isLoading ? (
                    <Container className='integrations-provider-list'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Container key={i} className='integrations-provider-row d-flex items-center content-between gap-1'>
                                <Skeleton variant='text' width={100} height={20} />
                                <Container className='d-flex items-center gap-025'>
                                    <Skeleton variant='circular' width={24} height={24} />
                                    <Skeleton variant='circular' width={24} height={24} />
                                </Container>
                            </Container>
                        ))}
                    </Container>
                ) : configuredIntegrations.length === 0 ? (
                    <Container className='integrations-empty-state'>
                        <Paragraph className='font-size-2 color-muted'>
                            No providers configured yet.
                        </Paragraph>
                    </Container>
                ) : (
                    <Container className='integrations-provider-list'>
                        {configuredIntegrations.map((integration) => (
                            <Container
                                key={integration.provider}
                                className='integrations-provider-row d-flex items-center content-between gap-1'
                            >
                                <Paragraph className='font-size-2 font-weight-5 color-primary'>
                                    {integration.providerName}
                                </Paragraph>

                                <Container className='integrations-provider-row-actions d-flex items-center gap-025'>
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='neutral'
                                        leftIcon={<Settings2 size={14} />}
                                        onClick={() => openEditProviderModal(integration)}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        size='sm'
                                        variant='ghost'
                                        intent='danger'
                                        leftIcon={<Trash2 size={14} />}
                                        onClick={() => { handleRemoveProvider(integration.provider); }}
                                        isLoading={busyProvider === integration.provider}
                                        disabled={isLoading}
                                    />
                                </Container>
                            </Container>
                        ))}
                    </Container>
                )}
            </SettingsSection>

            <Modal
                id={TEAM_AI_INTEGRATION_MODAL_ID}
                title={editingProvider ? 'Configure provider' : 'Add provider'}
                description='Set the API key and default model for this provider.'
                width='480px'
                footer={(
                    <>
                        <Button
                            variant='outline'
                            intent='neutral'
                            command='close'
                            commandfor={TEAM_AI_INTEGRATION_MODAL_ID}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant='solid'
                            intent='brand'
                            onClick={() => { handleSaveIntegration(); }}
                            isLoading={isSaving}
                            disabled={isSaving || !modalProvider}
                        >
                            Save
                        </Button>
                    </>
                )}
            >
                <Container className='p-1-5'>
                <Container className='d-flex column gap-1'>
                    {!editingProvider ? (
                        <Container className='d-flex column gap-05'>
                            <Paragraph className='font-size-2 font-weight-5 color-secondary'>Provider</Paragraph>
                            <Select
                                options={providerSelectOptions}
                                value={modalProvider}
                                onChange={handleModalProviderChange}
                                disabled={providerSelectOptions.length === 0}
                                placeholder='Select provider'
                            />
                        </Container>
                    ) : (
                        <Container className='d-flex column gap-025'>
                            <Paragraph className='font-size-1 color-muted'>Provider</Paragraph>
                            <Paragraph className='font-size-3 font-weight-5 color-primary'>
                                {integrationsByProvider.get(editingProvider)?.providerName || editingProvider}
                            </Paragraph>
                        </Container>
                    )}

                    {modalProvider !== 'ollama' && (
                        <FormField
                            label='API key'
                            type='password'
                            autoComplete='off'
                            value={modalApiKey}
                            onChange={(event) => setModalApiKey(event.target.value)}
                            placeholder={editingProvider ? 'Leave empty to keep current key' : 'sk-...'}
                        />
                    )}

                    {modalProvider === 'ollama' && (
                        <FormField
                            label='Endpoint'
                            type='text'
                            autoComplete='off'
                            value={modalEndpoint}
                            onChange={(event) => setModalEndpoint(event.target.value)}
                            placeholder={OLLAMA_DEFAULT_BASE_URL}
                        />
                    )}

                    {allModalModels.length > 0 && (
                        <Container className='d-flex column gap-05'>
                            <Paragraph className='font-size-2 font-weight-5 color-secondary'>
                                Enabled models
                            </Paragraph>
                            <Paragraph className='font-size-1 color-muted'>
                                {modalEnabledModels.size === 0
                                    ? 'All models are available. Select specific ones to restrict access.'
                                    : `${modalEnabledModels.size} of ${allModalModels.length} models enabled.`}
                            </Paragraph>
                            <Container className='integrations-model-checklist'>
                                {allModalModels.map((model) => {
                                    const isChecked = modalEnabledModels.has(model.id);
                                    return (
                                        <Container
                                            key={model.id}
                                            className='integrations-model-item d-flex items-center content-between gap-05'
                                        >
                                            <Container className='d-flex column' style={{ minWidth: 0 }}>
                                                <Paragraph className='font-size-2 color-primary text-truncate'>
                                                    {model.name}
                                                </Paragraph>
                                                {model.description && (
                                                    <Paragraph className='font-size-1 color-muted text-truncate'>
                                                        {model.description}
                                                    </Paragraph>
                                                )}
                                            </Container>
                                            <LiquidToggle
                                                pressed={isChecked}
                                                onChange={() => handleToggleModel(model.id)}
                                            />
                                        </Container>
                                    );
                                })}
                            </Container>
                        </Container>
                    )}

                    <Container className='d-flex column gap-05'>
                        <Paragraph className='font-size-2 font-weight-5 color-secondary'>Default model</Paragraph>
                        <Select
                            options={modalModelOptions}
                            value={modalDefaultModel}
                            onChange={setModalDefaultModel}
                            disabled={modalModelOptions.length === 0}
                            placeholder={modalModelOptions.length ? 'Select model' : 'No models available'}
                        />
                    </Container>

                    <Container className='d-flex items-center content-between gap-05 integrations-modal-toggle'>
                        <Paragraph className='font-size-2 color-muted'>Enabled</Paragraph>
                        <LiquidToggle pressed={modalEnabled} onChange={setModalEnabled} />
                    </Container>
                </Container>
                </Container>
            </Modal>
        </SettingsPage>
    );
};

export default IntegrationsSettings;
