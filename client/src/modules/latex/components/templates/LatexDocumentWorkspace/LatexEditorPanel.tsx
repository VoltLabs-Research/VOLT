import Editor from '@monaco-editor/react';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import { FileCode } from 'lucide-react';
import type { BeforeMount } from '@monaco-editor/react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';

interface LatexEditorPanelProps {
    activeFile: LatexFileEntry | undefined;
    content: string;
    onChange: (value: string | undefined) => void;
};

const PANEL_ICON = <FileCode size={14} />;

/**
 * Registers a lightweight Monarch tokenizer for LaTeX so Monaco highlights
 * commands, comments, and math delimiters instead of falling back to plaintext.
 * The guard prevents double-registration on HMR remounts.
 */
const handleBeforeMount: BeforeMount = (monaco) => {
    const alreadyRegistered = monaco.languages.getLanguages().some((l) => l.id === 'latex');
    if (alreadyRegistered) return;

    monaco.languages.register({ id: 'latex' });
    monaco.languages.setMonarchTokensProvider('latex', {
        tokenizer: {
            root: [
                [/%.*$/, 'comment'],
                [/\$\$[\s\S]*?\$\$/, 'string'],
                [/\$[^$]*\$/, 'string'],
                [/\\[a-zA-Z]+/, 'keyword'],
                [/[{}[\]]/, 'delimiter.bracket']
            ]
        }
    });
};

const LatexEditorPanel = ({ activeFile, content, onChange }: LatexEditorPanelProps) => (
    <Container className='latex-workspace__editor d-flex column'>
        <PanelHeader
            variant='compact'
            icon={PANEL_ICON}
            title={activeFile?.name ?? 'main.tex'}
        />
        <Container className='latex-workspace__editor-inner flex-1 min-h-0'>
            <Editor
                height='100%'
                language='latex'
                value={content}
                onChange={onChange}
                theme='vs-dark'
                beforeMount={handleBeforeMount}
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

export default LatexEditorPanel;
