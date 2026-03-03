import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { sileo } from 'sileo';
import { showPromise } from '@/shared/presentation/hooks/toast';
import {
    DefaultChatTransport,
    isToolUIPart,
    lastAssistantMessageIsCompleteWithApprovalResponses,
    lastAssistantMessageIsCompleteWithToolCalls
} from 'ai';
import type { UIMessage } from 'ai';
import useListTeamAIIntegrations from '@/modules/team/presentation/hooks/ai-integration/use-list-team-ai-integrations';
import useListTeamAIIntegrationModels from '@/modules/team/presentation/hooks/ai-integration/use-list-team-ai-integration-models';
import TokenStorage from '@/modules/auth/infrastructure/storage/TokenStorage';
import { aiConversationRepository } from '@/modules/ai/infrastructure/repositories/AIConversationRepository';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import type {
    TeamAIModelListItem,
    TeamAIProvider,
    TeamAIProviderModelsCatalog
} from '@/modules/team/domain/entities/TeamAIIntegration';
import type {
    AIConversation,
    AIConversationMessage
} from '@/modules/ai/domain/entities/AIConversation';

const sortConversations = (conversations: AIConversation[]) => {
    return [...conversations].sort((left, right) => {
        const leftDate = left.lastMessageAt || left.updatedAt || left.createdAt;
        const rightDate = right.lastMessageAt || right.updatedAt || right.createdAt;
        return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
};

const MODEL_SELECTION_KEY_SEPARATOR = '::';

const createModelSelectionKey = (provider: TeamAIProvider, modelId: string): string => (
    `${provider}${MODEL_SELECTION_KEY_SEPARATOR}${modelId}`
);

const toUIMessage = (message: AIConversationMessage): UIMessage => {
    const parts = Array.isArray(message.parts)
        ? message.parts as UIMessage['parts']
        : [];

    if (parts.length > 0) {
        return {
            id: message._id,
            role: message.role as UIMessage['role'],
            parts
        };
    }

    const fallbackText = message.content.trim();

    return {
        id: message._id,
        role: message.role as UIMessage['role'],
        parts: fallbackText ? [{ type: 'text', text: fallbackText }] : []
    };
};

const lastAssistantMessageHasProviderExecutedApprovalResponses = ({
    messages
}: {
    messages: UIMessage[];
}): boolean => {
    const message = messages[messages.length - 1];
    if (!message || message.role !== 'assistant') {
        return false;
    }

    const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => (
        part.type === 'step-start' ? index : lastIndex
    ), -1);

    const lastStepToolInvocations = message.parts
        .slice(lastStepStartIndex + 1)
        .filter(isToolUIPart);

    const hasApprovalResponse = lastStepToolInvocations.some((part) => (
        part.state === 'approval-responded'
    ));

    return (
        hasApprovalResponse
        && lastStepToolInvocations.every((part) => (
            part.state === 'output-available'
            || part.state === 'output-error'
            || part.state === 'approval-responded'
        ))
    );
};

interface UseAIPageOptions {
    navigateOnConversationChange?: boolean;
    onConversationChange?: (conversationId?: string) => void;
}

const useAIPage = (conversationId?: string, options: UseAIPageOptions = {}) => {
    const navigate = useNavigate();
    const navigateOnConversationChange = options.navigateOnConversationChange ?? true;
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const listTeamAIIntegrations = useListTeamAIIntegrations();
    const listTeamAIIntegrationModels = useListTeamAIIntegrationModels();

    const [conversations, setConversations] = useState<AIConversation[]>([]);
    const [integrations, setIntegrations] = useState<Array<{ provider: TeamAIProvider; isEnabled: boolean; hasApiKey: boolean }>>([]);
    const [providerCatalog, setProviderCatalog] = useState<TeamAIProviderModelsCatalog[]>([]);

    const [selectedModel, setSelectedModel] = useState<string | null>(null);

    const [isConversationsLoading, setIsConversationsLoading] = useState(false);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [isProviderCatalogLoading, setIsProviderCatalogLoading] = useState(false);

    const [conversationsError, setConversationsError] = useState<string | null>(null);
    const [messagesError, setMessagesError] = useState<string | null>(null);
    const [providerCatalogError, setProviderCatalogError] = useState<string | null>(null);
    const [sendMessageError, setSendMessageError] = useState<string | null>(null);
    const selectedModelRef = useRef<{ provider?: TeamAIProvider; model?: string }>({});
    const skipNextMessageLoadRef = useRef(false);

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation._id === conversationId) || null,
        [conversations, conversationId]
    );

    const enabledProviders = useMemo(() => {
        return new Set(
            integrations
                .filter((integration) => integration.isEnabled && integration.hasApiKey)
                .map((integration) => integration.provider)
        );
    }, [integrations]);

    const configuredProviderCatalog = useMemo(() => {
        return providerCatalog.filter((provider) => (
            enabledProviders.has(provider.provider) && provider.models.length > 0
        ));
    }, [enabledProviders, providerCatalog]);

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

    const selectedProvider = selectedModelDefinition?.provider || null;

    const noProviderConfigured = Boolean(
        selectedTeam?._id
        && !isProviderCatalogLoading
        && configuredProviderCatalog.length === 0
    );

    const canSendMessage = Boolean(
        selectedTeam?._id
        && selectedModelDefinition
        && !noProviderConfigured
    );

    const streamUrl = selectedTeam?._id && conversationId
        ? `${import.meta.env.VITE_API_URL}/api/ai/conversations/${selectedTeam._id}/${conversationId}/messages/stream`
        : '/api/ai/conversations/invalid/invalid/messages/stream';

    useEffect(() => {
        selectedModelRef.current = {
            provider: selectedModelDefinition?.provider,
            model: selectedModelDefinition?.id
        };
    }, [selectedModelDefinition?.id, selectedModelDefinition?.provider]);

    const chatTransport = useMemo(() => (
        new DefaultChatTransport({
            api: streamUrl,
            headers: () => {
                const token = new TokenStorage().getToken();
                return token
                    ? { Authorization: `Bearer ${token}` }
                    : {} as Record<string, string>;
            },
            body: () => ({
                provider: selectedModelRef.current.provider,
                model: selectedModelRef.current.model
            })
        })
    ), [streamUrl]);

    const loadConversations = useCallback(async () => {
        if (!selectedTeam?._id) {
            setConversations([]);
            setConversationsError(null);
            return;
        }

        setIsConversationsLoading(true);
        setConversationsError(null);

        try {
            const response = await aiConversationRepository.listConversations({
                page: 1,
                limit: 100,
                includeArchived: false
            });
            setConversations(sortConversations(response.data));
        } catch (error) {
            setConversationsError('Failed to load conversations. Please try again.');
            setConversations([]);
        } finally {
            setIsConversationsLoading(false);
        }
    }, [selectedTeam?._id]);

    const loadProviderCatalog = useCallback(async () => {
        if (!selectedTeam?._id) {
            setIntegrations([]);
            setProviderCatalog([]);
            setProviderCatalogError(null);
            return;
        }

        setIsProviderCatalogLoading(true);
        setProviderCatalogError(null);

        try {
            const [integrationsResponse, modelsResponse] = await Promise.all([
                listTeamAIIntegrations(),
                listTeamAIIntegrationModels()
            ]);

            setIntegrations(integrationsResponse.integrations.map((integration) => ({
                provider: integration.provider,
                isEnabled: integration.isEnabled,
                hasApiKey: integration.hasApiKey
            })));
            setProviderCatalog(modelsResponse.providers);
        } catch (error) {
            setProviderCatalogError('Failed to load provider catalog.');
            setIntegrations([]);
            setProviderCatalog([]);
        } finally {
            setIsProviderCatalogLoading(false);
        }
    }, [listTeamAIIntegrationModels, listTeamAIIntegrations, selectedTeam?._id]);

    const {
        messages: streamMessages,
        status: streamStatus,
        error: streamError,
        sendMessage,
        setMessages,
        addToolApprovalResponse
    } = useChat({
        id: conversationId ? `ai-conversation:${conversationId}` : `ai-draft:${selectedTeam?._id || 'none'}`,
        transport: chatTransport,
        sendAutomaticallyWhen: ({ messages }) => (
            lastAssistantMessageIsCompleteWithToolCalls({ messages })
            || lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
            || lastAssistantMessageHasProviderExecutedApprovalResponses({ messages })
        ),
        onFinish: () => {
            loadConversations().catch(() => {});
        }
    });

    const isSendingMessage = streamStatus === 'submitted' || streamStatus === 'streaming';

    const loadConversationMessages = useCallback(async (targetConversationId: string) => {
        if (!selectedTeam?._id || !targetConversationId) {
            setMessagesError(null);
            setMessages([]);
            return;
        }

        setIsMessagesLoading(true);
        setMessagesError(null);

        try {
            const response = await aiConversationRepository.listMessages(targetConversationId, {
                page: 1,
                limit: 200
            });
            setMessages(response.data.map(toUIMessage));
        } catch (error) {
            setMessagesError('Failed to load conversation messages.');
            setMessages([]);
        } finally {
            setIsMessagesLoading(false);
        }
    }, [selectedTeam?._id, setMessages]);

    useEffect(() => {
        loadConversations();
        loadProviderCatalog();
    }, [loadConversations, loadProviderCatalog]);

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

    const setSelectedProvider = useCallback((provider: TeamAIProvider) => {
        const providerModels = availableModelsForProvider.filter((model) => model.provider === provider);
        if (!providerModels.length) {
            setSelectedModel(null);
            return;
        }

        const defaultModel = providerModels.find((model) => model.isDefault) || providerModels[0];
        setSelectedModel(createModelSelectionKey(defaultModel.provider, defaultModel.id));
    }, [availableModelsForProvider]);

    useEffect(() => {
        if (!conversationId) {
            setMessagesError(null);
            setMessages([]);
            return;
        }
        if (skipNextMessageLoadRef.current) {
            skipNextMessageLoadRef.current = false;
            return;
        }
        loadConversationMessages(conversationId);
    }, [conversationId, loadConversationMessages, setMessages]);

    const handleConversationChange = useCallback((targetConversationId?: string) => {
        if (navigateOnConversationChange) {
            if (targetConversationId) {
                navigate(`/dashboard/ai/${targetConversationId}`);
            } else {
                navigate('/dashboard/ai');
            }
        }
        options.onConversationChange?.(targetConversationId);
    }, [navigate, navigateOnConversationChange, options.onConversationChange]);

    const handleSelectConversation = useCallback((targetConversationId: string) => {
        handleConversationChange(targetConversationId);
    }, [handleConversationChange]);

    const handleCreateConversation = useCallback(async (initialTitle?: string) => {
        const title = initialTitle?.trim() || 'New conversation';
        try {
            const conversation = await aiConversationRepository.createConversation({ title });

            setConversations((currentConversations) => sortConversations([
                conversation,
                ...currentConversations.filter((item) => item._id !== conversation._id)
            ]));

            skipNextMessageLoadRef.current = true;
            handleConversationChange(conversation._id);
            return conversation;
        } catch (error) {
            sileo.error({ title: 'Failed to create conversation' });
            throw error;
        }
    }, [handleConversationChange]);

    const handleDeleteConversation = useCallback(async (targetConversationId: string) => {
        await showPromise(
            aiConversationRepository.deleteConversation(targetConversationId),
            {
                loading: { title: 'Deleting conversation...' },
                success: { title: 'Conversation deleted' },
                error: { title: 'Failed to delete conversation' }
            }
        );

        setConversations((currentConversations) => (
            currentConversations.filter((conversation) => conversation._id !== targetConversationId)
        ));

        if (conversationId === targetConversationId) {
            handleConversationChange(undefined);
        }
    }, [conversationId, handleConversationChange]);

    const handleRenameConversation = useCallback(async (targetConversationId: string, title: string) => {
        const normalizedTitle = title.trim();
        if (!normalizedTitle) return;

        try {
            const updatedConversation = await aiConversationRepository.updateConversation(targetConversationId, {
                title: normalizedTitle
            });

            setConversations((currentConversations) => sortConversations(
                currentConversations.map((conversation) => (
                    conversation._id === targetConversationId
                        ? updatedConversation
                        : conversation
                ))
            ));
        } catch (error) {
            sileo.error({ title: 'Failed to rename conversation' });
            throw error;
        }
    }, []);

    useEffect(() => {
        if (streamError) {
            setSendMessageError(streamError.message);
            return;
        }

        setSendMessageError(null);
    }, [streamError]);

    const handleSendMessage = useCallback(async (text: string) => {
        const normalizedText = text.trim();
        if (!normalizedText || !canSendMessage || isSendingMessage || !conversationId) return;

        setSendMessageError(null);

        try {
            await sendMessage({ text: normalizedText });
        } catch (error) {
            const streamFailure = error instanceof Error ? error : new Error('Failed to send message');
            setSendMessageError(streamFailure.message);
            throw streamFailure;
        }
    }, [canSendMessage, conversationId, isSendingMessage, sendMessage]);

    const handleToolApprovalResponse = useCallback((
        approvalResponse: { id: string; approved: boolean; reason?: string }
    ) => {
        return addToolApprovalResponse(approvalResponse);
    }, [addToolApprovalResponse]);

    return {
        selectedTeam,
        activeConversation,
        conversations,
        messages: streamMessages,
        configuredProviderCatalog,
        availableModelsForProvider,
        selectedProvider,
        selectedModel,
        isConversationsLoading,
        isMessagesLoading,
        isProviderCatalogLoading,
        isSendingMessage,
        conversationsError,
        messagesError,
        providerCatalogError,
        sendMessageError,
        noProviderConfigured,
        canSendMessage,
        setSelectedProvider,
        setSelectedModel,
        loadConversations,
        loadConversationMessages,
        handleSelectConversation,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation,
        addToolApprovalResponse: handleToolApprovalResponse,
        handleSendMessage
    };
};

export default useAIPage;
