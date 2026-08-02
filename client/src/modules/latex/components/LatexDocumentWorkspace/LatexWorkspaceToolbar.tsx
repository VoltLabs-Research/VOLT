import EditableTag from '@/shared/ui/components/EditableTag';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import { Avatar, Button, Row, SaveStatusIndicator, Text } from '@voltstack/bravais';
import { Download, FileArchive, FileText, Play } from 'lucide-react';
import { IoSparklesOutline } from 'react-icons/io5';
import type { ReactNode } from 'react';
import type { PresenceUser } from '@volt/contracts/modules/socket/domain';

interface LatexWorkspaceToolbarProps {
    documentTitle: string;
    collaborators: PresenceUser[];
    isDirty: boolean;
    isSaving: boolean;
    isCompiling: boolean;
    isExportingTex: boolean;
    isExportingZip: boolean;
    hasCompiledPdf: boolean;
    hasCompileError: boolean;
    isAIPanelOpen: boolean;
    onRenameDocument: (title: string) => Promise<void>;
    onToggleAIPanel: () => void;
    onCompile: () => void;
    onExportTex: () => void;
    onExportPdf: () => void;
    onExportZip: () => void;
}

interface ToolbarAction {
    key: string;
    icon: ReactNode;
    label: string;
    title: string;
    disabled?: boolean;
    className?: string;
    onClick: () => void;
}

const getPresenceInitials = (user: PresenceUser): string => {
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
};

const describeCompileStatus = (isCompiling: boolean, hasCompileError: boolean, hasCompiledPdf: boolean): string => {
    if (isCompiling) return 'Compiling PDF preview.';
    if (hasCompileError) return 'PDF compilation failed.';
    if (!hasCompiledPdf) return 'Waiting for the first successful compile.';
    return 'Preview is ready.';
};

/** Document title, presence, save state and the workspace-wide actions. */
const LatexWorkspaceToolbar = ({
    documentTitle,
    collaborators,
    isDirty,
    isSaving,
    isCompiling,
    isExportingTex,
    isExportingZip,
    hasCompiledPdf,
    hasCompileError,
    isAIPanelOpen,
    onRenameDocument,
    onToggleAIPanel,
    onCompile,
    onExportTex,
    onExportPdf,
    onExportZip
}: LatexWorkspaceToolbarProps) => {
    const actions: ToolbarAction[] = [
        {
            key: 'ai',
            icon: <IoSparklesOutline size={14} />,
            label: 'Write with AI',
            title: 'Write with Volt AI',
            className: isAIPanelOpen
                ? 'latex-workspace__ai-trigger is-active'
                : 'latex-workspace__ai-trigger',
            onClick: onToggleAIPanel
        },
        {
            key: 'compile',
            icon: <Play size={14} />,
            label: 'Compile',
            title: 'Compile PDF',
            disabled: isCompiling,
            onClick: onCompile
        },
        {
            key: 'tex',
            icon: <Download size={14} />,
            label: '.tex',
            title: 'Export as .tex',
            disabled: isExportingTex,
            onClick: onExportTex
        },
        {
            key: 'pdf',
            icon: <FileText size={14} />,
            label: '.pdf',
            title: 'Export as .pdf',
            disabled: isCompiling,
            onClick: onExportPdf
        },
        {
            key: 'zip',
            icon: <FileArchive size={14} />,
            label: '.zip',
            title: 'Export as .zip (with assets)',
            disabled: isExportingZip,
            onClick: onExportZip
        }
    ];

    return (
        <>
            <Row justify='between' gap='1' className='latex-workspace__toolbar'>
                <Row minW='0'>
                    <EditableTag
                        as='span'
                        className='latex-workspace__toolbar-title color-primary'
                        onSave={onRenameDocument}
                        title='Double-click to rename'
                    >
                        {documentTitle}
                    </EditableTag>
                </Row>
                <Row gap='075'>
                    <ThemeToggleButton className='latex-workspace__theme-toggle' />
                    {collaborators.length > 0 && (
                        <Row className='latex-workspace__collaborators'>
                            {collaborators.map((user) => (
                                <Avatar
                                    key={user.id}
                                    size='xs'
                                    fallback={getPresenceInitials(user)}
                                    alt={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Collaborator'}
                                    className='latex-workspace__collaborator-avatar'
                                />
                            ))}
                        </Row>
                    )}
                    {isDirty && <span className='latex-workspace__dirty-dot' title='Unsaved changes' />}
                    {isDirty && !isSaving ? (
                        <Text as='span' tone='muted' className='latex-workspace__status-text' aria-live='polite'>
                            Unsaved changes
                        </Text>
                    ) : (
                        <SaveStatusIndicator
                            status={isSaving ? 'saving' : 'saved'}
                            hideIdle={false}
                            className='latex-workspace__status-text color-muted'
                        />
                    )}
                    {actions.map((action) => (
                        <Button
                            key={action.key}
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            shape='rounded'
                            className={action.className}
                            disabled={action.disabled}
                            onClick={action.onClick}
                            title={action.title}
                        >
                            {action.icon}
                            {action.label}
                        </Button>
                    ))}
                </Row>
            </Row>

            <div className='latex-workspace__sr-only' aria-live='polite'>
                {isSaving
                    ? 'Saving document changes.'
                    : isDirty
                        ? 'Unsaved document changes.'
                        : 'All document changes saved.'}
            </div>
            <div className='latex-workspace__sr-only' aria-live='polite'>
                {describeCompileStatus(isCompiling, hasCompileError, hasCompiledPdf)}
            </div>
        </>
    );
};

export default LatexWorkspaceToolbar;
