import AIConversationPanelContent from '@/modules/ai/components/AIConversationPanelContent';
import useAIPage from '@/modules/ai/hooks/use-ai-page';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Select from '@/shared/presentation/primitives/Select';
import Box from '@/shared/presentation/primitives/Box';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoAddOutline, IoCloseOutline, IoExpandOutline } from 'react-icons/io5';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import { useNavigate } from 'react-router-dom';
interface LatexAIPanelProps {
    documentId: string;
    documentTitle: string;
    files: LatexFileEntry[];
    width?: number;
    height?: number;
    onClose: () => void;
};

const buildDocumentContext = (documentId: string, documentTitle: string, files: LatexFileEntry[]): string => {
    const fileList = files.map((f) => `- ${f.name} (ID: ${f._id})`).join('\n');
    return `[Context: LaTeX document "${documentTitle}", documentId: ${documentId}]
[Current Files in Workspace:
${fileList}]

IMPORTANT INSTRUCTIONS:
1. DO NOT create new .tex files if one already exists (e.g., "main.tex").
2. ALWAYS prefer editing existing files instead of creating "Untitled" or "template" files.
3. If the user asks to "write" or "edit", find the most relevant existing file (like "main.tex") and use the appropriate tool to update it.
4. Your goal is to keep the workspace clean and maintain existing file structures.

`;
};

const LatexAIPanel = ({ documentId, documentTitle, files, width, height, onClose }: LatexAIPanelProps) => {
    const navigate = useNavigate();
    const [conversationId, setConversationId] = useState<string | undefined>();
    const [messageDraft, setMessageDraft] = useState('');
    const contextInjectedRef = useRef(false);

    const {
        selectedTeam,
        messages,
        conversations,
        availableModelsForProvider,
        selectedModel,
        isMessagesLoading,
        isProviderCatalogLoading,
        isSendingMessage,
        conversationsError,
        messagesError,
        providerCatalogError,
        sendMessageError,
        noProviderConfigured,
        canSendMessage,
        accessDenied,
        accessDeniedMessage,
        loadConversations,
        loadProviderCatalog,
        setSelectedModel,
        handleSelectConversation,
        handleCreateConversation,
        addToolApprovalResponse,
        handleSendMessage,
        loadConversationMessages,
        isConversationsLoading
    } = useAIPage(conversationId, {
        navigateOnConversationChange: false,
        onConversationChange: setConversationId
    });

    // Reset context injection flag when conversation changes
    useEffect(() => {
        contextInjectedRef.current = !!conversationId;
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId) return;

        const pendingMessage = sessionStorage.getItem('volt:ai:pending-message');
        if (!pendingMessage) return;

        sessionStorage.removeItem('volt:ai:pending-message');

        handleSendMessage(pendingMessage).catch(() => {
            sessionStorage.setItem('volt:ai:pending-message', pendingMessage);
            setMessageDraft(pendingMessage);
        });
    }, [conversationId, handleSendMessage]);

    const conversationOptions: SelectOption[] = useMemo(() => {
        return conversations.map((conversation) => ({
            value: conversation._id,
            title: conversation.title || 'Untitled Conversation',
            description: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : undefined
        }));
    }, [conversations]);

    const modelOptions: SelectOption[] = useMemo(() => {
        return availableModelsForProvider.map((model) => ({
            value: `${model.provider}::${model.id}`,
            title: model.name,
            description: model.providerName
        }));
    }, [availableModelsForProvider]);

    const prependContext = useCallback((text: string): string => {
        if (contextInjectedRef.current) return text;
        contextInjectedRef.current = true;
        return `${buildDocumentContext(documentId, documentTitle, files)}${text}`;
    }, [documentId, documentTitle, files]);

    const handleSend = useCallback(async () => {
        const rawDraft = messageDraft.trim();
        if (!rawDraft) return;

        setMessageDraft('');

        try {
            if (!conversationId) {
                const contextualMessage = prependContext(rawDraft);
                sessionStorage.setItem('volt:ai:pending-message', contextualMessage);
                await handleCreateConversation(rawDraft);
                return;
            }

            await handleSendMessage(prependContext(rawDraft));
        } catch {
            setMessageDraft(rawDraft);
        }
    }, [conversationId, handleCreateConversation, handleSendMessage, messageDraft, prependContext]);

    const handleNewConversation = useCallback(() => {
        contextInjectedRef.current = false;
        setConversationId(undefined);
        setMessageDraft('');
    }, []);

    const handleOpenTabularArtifact = useCallback((artifact: AIMessageArtifact) => {
        if (!conversationId) return;
        navigate(`/dashboard/ai/${conversationId}?artifactId=${encodeURIComponent(artifact.id)}`);
        onClose();
    }, [conversationId, navigate, onClose]);

    const openAIPage = useCallback(() => {
        const targetPath = conversationId
            ? `/dashboard/ai/${conversationId}`
            : '/dashboard/ai';
        navigate(targetPath);
        onClose();
    }, [conversationId, navigate, onClose]);

    const handleRetry = useCallback(() => {
        if (conversationId) {
            loadConversationMessages(conversationId).catch(console.warn);
        }
    }, [conversationId, loadConversationMessages]);

    const content = (
        <AIConversationPanelContent
            conversationId={conversationId}
            messages={messages}
            isMessagesLoading={isMessagesLoading}
            isSendingMessage={isSendingMessage}
            messagesError={messagesError}
            messageDraft={messageDraft}
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            canSendMessage={canSendMessage}
            isProviderCatalogLoading={isProviderCatalogLoading}
            noProviderConfigured={noProviderConfigured}
            sendMessageError={sendMessageError}
            selectedTeamId={selectedTeam?._id}
            accessDenied={accessDenied}
            accessDeniedMessage={accessDeniedMessage}
            addToolApprovalResponse={addToolApprovalResponse}
            onMessageDraftChange={setMessageDraft}
            onModelChange={setSelectedModel}
            onSend={handleSend}
            onOpenTableArtifact={handleOpenTabularArtifact}
            onRetry={handleRetry}
            onOpenIntegrations={() => navigate('/dashboard/settings/integrations')}
        />
    );

    return (
        <Stack id='latex-ai-panel' className='latex-ai-panel' style={{ width, height }}>
            <Row justify='between' className='latex-ai-panel__header'>
                <Row gap='025' flex='1' minW='0'>
                    <Tooltip content='New conversation' placement='top'>
                        <IconButton
                            variant='ghost'
                            size='sm'
                            onClick={handleNewConversation}
                            disabled={noProviderConfigured || isProviderCatalogLoading}
                        >
                            <IoAddOutline size={16} />
                        </IconButton>
                    </Tooltip>

                    <Select
                        className='latex-ai-panel__header-select'
                        options={conversationOptions}
                        value={conversationId ?? null}
                        onChange={handleSelectConversation}
                        placeholder='Select conversation'
                        disabled={isConversationsLoading}
                        showSelectionIcon={false}
                    />

                    <Tooltip content='Open full AI page' placement='top'>
                        <IconButton variant='ghost' size='sm' onClick={openAIPage}>
                            <IoExpandOutline size={16} />
                        </IconButton>
                    </Tooltip>
                </Row>

                <Tooltip content='Close AI panel' placement='top'>
                    <IconButton variant='ghost' size='sm' onClick={onClose}>
                        <IoCloseOutline size={16} />
                    </IconButton>
                </Tooltip>
            </Row>

            {providerCatalogError && (
                <Box className='latex-ai-panel__alert'>
                    <RecoveryState
                        title='Unable to load AI providers'
                        description={providerCatalogError}
                        tone={RecoveryStateTone.Error}
                        onRetry={() => {
                            loadProviderCatalog().catch(() => undefined);
                        }}
                    />
                </Box>
            )}

            {conversationsError && (
                <Box className='latex-ai-panel__alert'>
                    <RecoveryState
                        title='Unable to load conversations'
                        description={conversationsError}
                        tone={RecoveryStateTone.Error}
                        onRetry={() => {
                            loadConversations().catch(() => undefined);
                        }}
                    />
                </Box>
            )}

            {content}
        </Stack>
    );
};

export default LatexAIPanel;
