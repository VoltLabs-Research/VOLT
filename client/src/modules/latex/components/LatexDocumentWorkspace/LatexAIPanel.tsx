import useAIConversationPanel from '@/modules/ai/components/AIConversationPanelContent/use-ai-conversation-panel';
import AIConversationAlerts from '@/modules/ai/components/AIConversationPanelContent/AIConversationAlerts';
import { Select, IconButton, Row, Stack, Tooltip } from '@voltstack/bravais';
import { useCallback, useEffect, useRef } from 'react';
import { IoAddOutline, IoCloseOutline, IoExpandOutline } from 'react-icons/io5';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
interface LatexAIPanelProps {
    documentId: string;
    documentTitle: string;
    files: LatexFileEntry[];
    width?: number;
    height?: number;
    onClose: () => void;
}

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

const trimMessageDraft = (draft: string) => draft.trim();

const LatexAIPanel = ({ documentId, documentTitle, files, width, height, onClose }: LatexAIPanelProps) => {
    const contextInjectedRef = useRef(false);

    const prependContext = useCallback((text: string): string => {
        if (contextInjectedRef.current) return text;
        contextInjectedRef.current = true;
        return `${buildDocumentContext(documentId, documentTitle, files)}${text}`;
    }, [documentId, documentTitle, files]);

    const {
        conversationId,
        conversationOptions,
        conversationPanelContent,
        conversationsError,
        handleSelectConversation,
        isConversationsLoading,
        isProviderCatalogLoading,
        loadConversations,
        loadProviderCatalog,
        noProviderConfigured,
        openAIPage,
        providerCatalogError,
        resetConversationState
    } = useAIConversationPanel({
        normalizeDraft: trimMessageDraft,
        prepareMessage: prependContext,
        onNavigateAway: onClose
    });

    // Reset context injection flag when conversation changes
    useEffect(() => {
        contextInjectedRef.current = !!conversationId;
    }, [conversationId]);

    const handleNewConversation = useCallback(() => {
        contextInjectedRef.current = false;
        resetConversationState();
    }, [resetConversationState]);

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

            <AIConversationAlerts
                className='latex-ai-panel__alert'
                providerCatalogError={providerCatalogError}
                conversationsError={conversationsError}
                loadProviderCatalog={loadProviderCatalog}
                loadConversations={loadConversations}
            />

            {conversationPanelContent}
        </Stack>
    );
};

export default LatexAIPanel;
