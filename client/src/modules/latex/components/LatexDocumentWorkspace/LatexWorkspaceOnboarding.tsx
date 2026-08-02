import { Box, Button, EmptyState, Row, Stack } from '@voltstack/bravais';
import { FileText, FolderUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { LatexFileEntry } from '@/modules/latex/contracts/workspace';
import type { ChangeEvent, RefObject } from 'react';

interface LatexWorkspaceOnboardingProps {
    documentId: string;
    /** Empty `main.tex` left behind by older documents, reused instead of adding a second file. */
    legacyPlaceholderFile: LatexFileEntry | null;
    isUploading: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    folderInputRef: RefObject<HTMLInputElement | null>;
    onCreateFile: (name: string, path?: string, content?: string) => Promise<unknown>;
    onUpdateFile: (input: { documentId: string; fileId: string; content?: string }) => Promise<unknown>;
    onDeleteFile: (input: { documentId: string; fileId: string }) => Promise<unknown>;
    onSelectFile: (fileId: string) => void;
    onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    onUploadFolders: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    onEnteredChange: (hasEntered: boolean) => void;
}

const LATEX_TEMPLATE_CONTENT = `\\documentclass{article}

\\begin{document}

Hello, world!

\\end{document}
`;

/** First screen of an empty document: start from a template or import a project. */
const LatexWorkspaceOnboarding = ({
    documentId,
    legacyPlaceholderFile,
    isUploading,
    fileInputRef,
    folderInputRef,
    onCreateFile,
    onUpdateFile,
    onDeleteFile,
    onSelectFile,
    onUploadFiles,
    onUploadFolders,
    onEnteredChange
}: LatexWorkspaceOnboardingProps) => {
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [isImportingProject, setIsImportingProject] = useState(false);

    const handleStartFromTemplate = async (): Promise<void> => {
        setIsCreatingTemplate(true);

        try {
            if (legacyPlaceholderFile) {
                await onUpdateFile({
                    documentId,
                    fileId: legacyPlaceholderFile._id,
                    content: LATEX_TEMPLATE_CONTENT
                });
                onSelectFile(legacyPlaceholderFile._id);
            } else {
                await onCreateFile('main.tex', undefined, LATEX_TEMPLATE_CONTENT);
            }
            onEnteredChange(true);
        } catch {
            onEnteredChange(false);
        } finally {
            setIsCreatingTemplate(false);
        }
    };

    const handleFolderSelection = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const fileList = event.target.files;

        if (!fileList || fileList.length === 0) {
            return;
        }

        setIsImportingProject(true);

        try {
            if (legacyPlaceholderFile) {
                await onDeleteFile({
                    documentId,
                    fileId: legacyPlaceholderFile._id
                });
            }
            await onUploadFolders(event);
            onEnteredChange(true);
        } catch {
            onEnteredChange(false);
        } finally {
            setIsImportingProject(false);
        }
    };

    return (
        <Box display='flex' flex='1' align='center' justify='center' p='2' className='latex-workspace__empty-layout'>
            <input
                ref={fileInputRef}
                type='file'
                className='d-none'
                multiple
                aria-label='Upload files to the LaTeX workspace'
                onChange={onUploadFiles}
            />

            <input
                ref={folderInputRef}
                type='file'
                className='d-none'
                aria-label='Upload a folder to the LaTeX workspace'
                onChange={(event) => {
                    void handleFolderSelection(event);
                }}
                {...({
                    webkitdirectory: '',
                    directory: ''
                } as Record<string, string>)}
            />

            <Stack align='center' gap='1' className='latex-workspace__empty-shell'>
                <EmptyState
                    title='Start your LaTeX project'
                    description='Create a starter .tex file from a template or upload an existing project folder to begin working.'
                    icon={<FileText size={28} />}
                />
                <Row gap='075'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='md'
                        shape='pill'
                        onClick={() => {
                            void handleStartFromTemplate();
                        }}
                        isLoading={isCreatingTemplate}
                        leftIcon={<Sparkles size={14} />}
                    >
                        Start from a template
                    </Button>
                    <Button
                        variant='solid'
                        intent='white'
                        size='md'
                        shape='pill'
                        onClick={() => folderInputRef.current?.click()}
                        disabled={isUploading || isImportingProject}
                        isLoading={isImportingProject}
                        leftIcon={<FolderUp size={14} />}
                    >
                        Upload Project
                    </Button>
                </Row>
            </Stack>
        </Box>
    );
};

export default LatexWorkspaceOnboarding;
