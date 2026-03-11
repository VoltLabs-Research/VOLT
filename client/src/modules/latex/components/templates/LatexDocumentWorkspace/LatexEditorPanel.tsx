import Editor from '@monaco-editor/react';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import { FileCode } from 'lucide-react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';

interface LatexEditorPanelProps {
    activeFile: LatexFileEntry | undefined;
    content: string;
    onChange: (value: string | undefined) => void;
};

const LatexEditorPanel = ({ activeFile, content, onChange }: LatexEditorPanelProps) => {
    const panelIcon = <FileCode size={14} />;

    return (
        <Container className='latex-workspace__editor d-flex column'>
            <PanelHeader
                variant='compact'
                icon={panelIcon}
                title={activeFile?.name ?? 'main.tex'}
            />
            <Container className='latex-workspace__editor-inner flex-1 min-h-0'>
                <Editor
                    height='100%'
                    language='latex'
                    value={content}
                    onChange={onChange}
                    theme='vs-dark'
                    options={{
                        fontSize: 13,
                        minimap: { enabled: false },
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        renderWhitespace: 'none',
                        padding: { top: 12 }
                    }}
                />
            </Container>
        </Container>
    );
};

export default LatexEditorPanel;
