import type { BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    tex: 'latex',
    bib: 'latex',
    cls: 'latex',
    sty: 'latex',
    json: 'json',
    js: 'javascript',
    ts: 'typescript',
    css: 'css',
    html: 'html',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    py: 'python',
    sh: 'shell'
};

export const MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
    fontSize: 13,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    renderWhitespace: 'none',
    padding: { top: 12 },
    fontLigatures: false
};

export const getFileLanguage = (filename: string): string => {
    const extension = filename.toLowerCase().split('.').pop() ?? '';
    return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext';
};

/** Teaches Monaco just enough LaTeX to colour comments, math and macros. */
export const registerLatexLanguage: BeforeMount = (monaco) => {
    if (monaco.languages.getLanguages().some((language) => language.id === 'latex')) {
        return;
    }

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
