import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { Settings2, Trash2 } from 'lucide-react';
import { Skeleton } from '@mui/material';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import SettingsPage from '@/modules/auth/components/templates/Settings/SettingsPage';
import SettingsSection from '@/modules/auth/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/components/molecules/SettingsSectionHeader';
import { showPromise } from '@/shared/presentation/hooks/toast';
import {
    AI_INTEGRATION_QUERY_KEYS,
    useTeamAIIntegrationsQuery,
    useTeamAIIntegrationModelsQuery,
    useDiscoverTeamAIProviderModelsQuery
} from '@/modules/team/hooks/ai-integration/queries';
import queryClient from '@/shared/infrastructure/query/query-client';
import useCreateTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-create-team-ai-integration';
import useUpdateTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-update-team-ai-integration';
import useDeleteTeamAIIntegration from '@/modules/team/hooks/ai-integration/use-delete-team-ai-integration';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamAIIntegrationsSocketSync from '@/modules/socket/hooks/use-team-ai-integrations-socket-sync';
import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type {
    TeamAIIntegration,
    TeamAIModelMetadata,
    TeamAIProviderModelsCatalog
} from '@/modules/team/api/entities/team-ai-integration';
import { AI_PROVIDER_CATALOG } from '@/modules/ai/api/entities/ai-constants';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/api/dtos/create-team-ai-integration';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/api/dtos/update-team-ai-integration';
import './IntegrationsSettings.css';

const TEAM_AI_INTEGRATION_MODAL_ID = 'team-ai-integration-modal';
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

type ModalModelOption = Pick<TeamAIModelMetadata, 'id' | 'name' | 'description'>;

const resolveOllamaBaseUrl = (metadata?: Record<string, unknown>): string => {
    if (typeof metadata?.baseUrl === 'string') {
        return metadata.baseUrl;
    }
    return OLLAMA_DEFAULT_BASE_URL;
};

const IntegrationsSettings: React.FC = () => {
    const teamId = useSelectedTeamId() ?? '';

    const {
        data: integrationsData,
        isLoading: isIntegrationsLoading,
        error: integrationsError
    } = useTeamAIIntegrationsQuery(teamId, { enabled: !!teamId });

    const {
        data: modelsData,
        isLoading: isModelsLoading,
        error: modelsError
    } = useTeamAIIntegrationModelsQuery(teamId, { enabled: !!teamId });

    const createTeamAIIntegration = useCreateTeamAIIntegration();
    const updateTeamAIIntegration = useUpdateTeamAIIntegration();
    const deleteTeamAIIntegration = useDeleteTeamAIIntegration();

    const isLoading = isIntegrationsLoading || isModelsLoading;
    const [isSaving, setIsSaving] = useState(false);
    const [busyProvider, setBusyProvider] = useState<AIProvider | null>(null);

    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
    const [modalProvider, setModalProvider] = useState<AIProvider | null>(null);
    const [modalApiKey, setModalApiKey] = useState('');
    const [modalEndpoint, setModalEndpoint] = useState(OLLAMA_DEFAULT_BASE_URL);
    const [modalDefaultModel, setModalDefaultModel] = useState<string | null>(null);
    const [modalEnabledModels, setModalEnabledModels] = useState<Set<string>>(new Set());
    const [modalEnabled, setModalEnabled] = useState(true);

    const discoveryApiKey = modalApiKey.trim();
    const discoveryMetadata = useMemo(() => (
        modalProvider === 'ollama'
            ? { baseUrl: modalEndpoint.trim() || OLLAMA_DEFAULT_BASE_URL }
            : undefined
    ), [modalEndpoint, modalProvider]);

    const shouldDiscoverModels = Boolean(
        teamId
        && modalProvider
        && (
            modalProvider === 'ollama'
                ? (discoveryMetadata?.baseUrl?.trim().length ?? 0) > 0
                : true
        )
    );

    const {
        data: discoveredModelsData,
        isFetching: isDiscoveringModels
    } = useDiscoverTeamAIProviderModelsQuery(
        {
            teamId,
            provider: (modalProvider ?? 'openai') as AIProvider,
            apiKey: modalProvider === 'ollama' ? undefined : discoveryApiKey || undefined,
            metadata: discoveryMetadata
        },
        {
            enabled: shouldDiscoverModels
        }
    );

    useEffect(() => {
        const error = integrationsError || modelsError;
        if (!error) return;
        if (ApiError.isRBACError(error)) {
            const message = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
            sileo.error({ title: message });
            return;
        }
        sileo.error({ title: 'Failed to load integrations' });
    }, [integrationsError, modelsError]);

    const integrations: TeamAIIntegration[] = integrationsData?.integrations ?? [];
    const providerModels: TeamAIProviderModelsCatalog[] = modelsData?.providers ?? [];

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

    const allModalModels: ModalModelOption[] = useMemo(() => {
        if (!modalProvider) {
            return [];
        }

        const discoveredModels = discoveredModelsData?.provider === modalProvider
            ? discoveredModelsData.models
            : null;

        if (discoveredModels?.length) {
            return discoveredModels;
        }

        return modelsByProvider.get(modalProvider)?.models || discoveredModels || [];
    }, [discoveredModelsData, modalProvider, modelsByProvider]);

    const refreshData = useCallback(() => {
        if (!teamId) return;
        void Promise.all([
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId) }),
            queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId) })
        ]);
    }, [teamId]);

    const modalModelOptions: SelectOption[] = useMemo(() => {
        const models = modalEnabledModels.size > 0
            ? allModalModels.filter((model) => modalEnabledModels.has(model.id))
            : allModalModels;

        return models.map((model) => ({
            value: model.id,
            title: model.name,
            description: model.description
        }));
    }, [allModalModels, modalEnabledModels]);

    const resolveDefaultModel = useCallback((provider: AIProvider, enabledModels?: Set<string>): string | null => {
        const discoveredCatalog = discoveredModelsData?.provider === provider
            ? discoveredModelsData
            : null;

        const discoveredModels = discoveredCatalog?.models ?? [];
        const catalog = modelsByProvider.get(provider);
        const sourceModels = discoveredModels.length > 0
            ? discoveredModels
            : (catalog?.models || []);

        if (!sourceModels.length) {
            return null;
        }

        const availableModels = enabledModels?.size
            ? sourceModels.filter((model: ModalModelOption) => enabledModels.has(model.id))
            : sourceModels;

        if (!availableModels.length) {
            return null;
        }

        const candidateDefault = discoveredModels.length > 0
            ? discoveredCatalog?.defaultModel
            : catalog?.defaultModel;

        if (candidateDefault && availableModels.some((model: ModalModelOption) => model.id === candidateDefault)) {
            return candidateDefault;
        }

        return availableModels[0]?.id || null;
    }, [discoveredModelsData, modelsByProvider]);

    useTeamAIIntegrationsSocketSync(teamId || null);

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
        if (!teamId) {
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
        const nextProvider = provider as AIProvider;
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
                if (next.size === 1) {
                    return prev;
                }
                next.delete(modelId);
            } else {
                next.add(modelId);
            }
            return next;
        });
    };

    useEffect(() => {
        if (!modalProvider) {
            return;
        }

        const availableModels = modalEnabledModels.size > 0
            ? allModalModels.filter((model) => modalEnabledModels.has(model.id))
            : allModalModels;

        if (!availableModels.length) {
            if (modalDefaultModel !== null) {
                setModalDefaultModel(null);
            }
            return;
        }

        const hasValidSelection = modalDefaultModel
            ? availableModels.some((model) => model.id === modalDefaultModel)
            : false;

        if (hasValidSelection) {
            return;
        }

        setModalDefaultModel(resolveDefaultModel(modalProvider, modalEnabledModels));
    }, [allModalModels, modalDefaultModel, modalEnabledModels, modalProvider, resolveDefaultModel]);

    useEffect(() => {
        if (editingProvider || !modalProvider || modalEnabledModels.size > 0) {
            return;
        }

        const nextDefaultModel = resolveDefaultModel(modalProvider);
        if (!nextDefaultModel) {
            return;
        }

        setModalEnabledModels(new Set([nextDefaultModel]));
    }, [editingProvider, modalEnabledModels, modalProvider, resolveDefaultModel]);

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
            refreshData();
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveProvider = async (provider: AIProvider) => {
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
            refreshData();
        } catch (error: unknown) {
            if (ApiError.isRBACError(error)) return;
        } finally {
            setBusyProvider(null);
        }
    };

    const canAddProvider = Boolean(teamId && availableProviders.length > 0);

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

                {!teamId ? (
                    <Paragraph className='font-size-2 color-muted'>
                        Select a team to manage integrations.
                    </Paragraph>
                ) : isLoading ? (
                    <Container className='integrations-provider-list'>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Container key={index} className='integrations-provider-row d-flex items-center content-between gap-1'>
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
                            <FormFieldRHF
                                label='API key'
                                type='password'
                                inputProps={{ autoComplete: 'off' }}
                                value={modalApiKey}
                                onChange={(event) => setModalApiKey(event.target.value)}
                                placeholder={editingProvider ? 'Leave empty to keep current key' : 'sk-...'}
                            />
                        )}

                        {modalProvider === 'ollama' && (
                            <FormFieldRHF
                                label='Endpoint'
                                type='text'
                                inputProps={{ autoComplete: 'off' }}
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
                                        ? 'Only the default model is enabled.'
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
                            {isDiscoveringModels && modalModelOptions.length === 0 && (
                                <Paragraph className='font-size-1 color-muted'>Loading available models...</Paragraph>
                            )}
                            <Select
                                options={modalModelOptions}
                                value={modalDefaultModel}
                                onChange={setModalDefaultModel}
                                disabled={isDiscoveringModels || modalModelOptions.length === 0}
                                placeholder={isDiscoveringModels
                                    ? 'Loading models...'
                                    : (modalModelOptions.length ? 'Select model' : 'No models available')}
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
