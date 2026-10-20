import { useTeamAIIntegrationModelsQuery, useTeamAIIntegrationsQuery } from '@/modules/team/hooks/ai-integration/queries';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIModelSelection } from '@/modules/ai/api/service';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIModelListItem } from '@volt/contracts/modules/team/domain';

const createModelSelectionKey = (provider: AIProvider, modelId: string): string => (
    `${provider}::${modelId}`
);

const useAIModelSelection = (teamId: string | null) => {
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const selectedModelRef = useRef<AIModelSelection>({});

    const teamAIIntegrationsQuery = useTeamAIIntegrationsQuery(teamId ?? '', {
        enabled: Boolean(teamId)
    });

    const teamAIIntegrationModelsQuery = useTeamAIIntegrationModelsQuery(teamId ?? '', {
        enabled: Boolean(teamId)
    });

    const isProviderCatalogLoading = teamAIIntegrationsQuery.isLoading || teamAIIntegrationModelsQuery.isLoading;
    let providerCatalogError: string | null = null;
    if (teamAIIntegrationsQuery.error || teamAIIntegrationModelsQuery.error) {
        providerCatalogError = 'Failed to load provider catalog.';
    }

    const enabledProviders = useMemo(() => {
        return new Set(
            (teamAIIntegrationsQuery.data?.integrations ?? [])
                .filter((integration) => integration.isEnabled && integration.hasApiKey)
                .map((integration) => integration.provider)
        );
    }, [teamAIIntegrationsQuery.data]);

    const configuredProviderCatalog = useMemo(() => {
        return (teamAIIntegrationModelsQuery.data?.providers ?? []).filter((provider) => (
            enabledProviders.has(provider.provider) && provider.models.length > 0
        ));
    }, [enabledProviders, teamAIIntegrationModelsQuery.data]);

    const availableModelsForProvider = useMemo<TeamAIModelListItem[]>(() => {
        return configuredProviderCatalog
            .flatMap((provider) => (
                provider.models.map((model) => ({
                    ...model,
                    provider: provider.provider,
                    providerName: provider.providerName,
                    isDefault: provider.defaultModel === model.id
                }))
            ))
            .sort((left, right) => {
                if (left.isDefault !== right.isDefault) {
                    return left.isDefault ? -1 : 1;
                }

                if (left.providerName !== right.providerName) {
                    return left.providerName.localeCompare(right.providerName);
                }
                return left.name.localeCompare(right.name);
            });
    }, [configuredProviderCatalog]);

    const selectedModelDefinition = useMemo(() => {
        if (!selectedModel) return null;

        return availableModelsForProvider.find((model) => (
            createModelSelectionKey(model.provider, model.id) === selectedModel
        )) || null;
    }, [availableModelsForProvider, selectedModel]);

    const noProviderConfigured = Boolean(
        teamId
        && !isProviderCatalogLoading
        && configuredProviderCatalog.length === 0
    );

    const canSendMessage = Boolean(
        teamId
        && selectedModelDefinition
        && !noProviderConfigured
    );

    selectedModelRef.current = {
        provider: selectedModelDefinition?.provider,
        model: selectedModelDefinition?.id
    };

    useEffect(() => {
        if (!availableModelsForProvider.length) {
            setSelectedModel(null);
            return;
        }

        setSelectedModel((currentModel) => {
            if (currentModel && availableModelsForProvider.some((model) => (
                createModelSelectionKey(model.provider, model.id) === currentModel
            ))) {
                return currentModel;
            }

            const defaultModel = availableModelsForProvider.find((model) => model.isDefault) || availableModelsForProvider[0];
            if (!defaultModel) return null;

            return createModelSelectionKey(defaultModel.provider, defaultModel.id);
        });
    }, [availableModelsForProvider]);

    return {
        selectedModel,
        availableModelsForProvider,
        noProviderConfigured,
        canSendMessage,
        isProviderCatalogLoading,
        providerCatalogError,
        loadProviderCatalog: async () => {
            await Promise.all([
                teamAIIntegrationsQuery.refetch(),
                teamAIIntegrationModelsQuery.refetch()
            ]);
        },
        selectedModelRef,
        setSelectedModel
    };
};

export default useAIModelSelection;
