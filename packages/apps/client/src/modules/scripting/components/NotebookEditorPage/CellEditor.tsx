import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

// How a cell runs from the keyboard: Ctrl/Cmd+Enter stays, Shift+Enter moves to the next cell,
// Alt+Enter inserts one below.
export type CellRunMode = 'stay' | 'next' | 'insert';

export interface CellCompletion {
    matches: string[];
    cursorStart: number;
    cursorEnd: number;
}

interface CellEditorProps {
    cellId: string;
    value: string;
    language: 'python' | 'markdown' | 'plaintext';
    theme: string;
    // When it changes to a value other than 0, the editor takes the focus.
    focusRequest: number;
    onChange: (value: string) => void;
    onRun: (mode: CellRunMode) => void;
    onFocus: () => void;
    onBlur?: () => void;
    complete?: (code: string, cursor: number) => Promise<CellCompletion>;
}

const MIN_HEIGHT = 38;

const OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 12,
    lineNumbersMinChars: 0,
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    renderLineHighlight: 'none',
    // The page scrolls; a cell is as tall as its code.
    scrollbar: { vertical: 'hidden', horizontal: 'auto', alwaysConsumeMouseWheel: false, verticalScrollbarSize: 0 },
    fontSize: 13,
    padding: { top: 10, bottom: 10 },
    tabSize: 4,
    insertSpaces: true,
    // Completions come from the kernel, on Ctrl+Space and after a dot.
    quickSuggestions: false,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'off',
    fixedOverflowWidgets: true,
    contextmenu: false
};

// The kernel's completions for the cell a model belongs to. The provider is the language's, so it
// is registered once and finds the cell by its model.
const completers = new Map<string, (code: string, cursor: number) => Promise<CellCompletion>>();
let completionProvider: Monaco.IDisposable | null = null;

const registerCompletionProvider = (monaco: typeof Monaco): void => {
    if(completionProvider){
        return;
    }
    completionProvider = monaco.languages.registerCompletionItemProvider('python', {
        triggerCharacters: ['.'],
        provideCompletionItems: async (model, position) => {
            const complete = completers.get(model.uri.toString());
            if(!complete){
                return { suggestions: [] };
            }
            const reply = await complete(model.getValue(), model.getOffsetAt(position));
            const start = model.getPositionAt(reply.cursorStart);
            const end = model.getPositionAt(reply.cursorEnd);
            const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
            return {
                suggestions: reply.matches.map((match) => ({
                    label: match.slice(match.lastIndexOf('.') + 1),
                    filterText: match,
                    insertText: match,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    range
                }))
            };
        }
    });
};

const CellEditor = ({ cellId, value, language, theme, focusRequest, onChange, onRun, onFocus, onBlur, complete }: CellEditorProps) => {
    const [height, setHeight] = useState(MIN_HEIGHT);
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    // The latest callbacks, for the editor's actions, which are added once.
    const callbacks = useRef({ onRun, onFocus, onBlur, complete });
    callbacks.current = { onRun, onFocus, onBlur, complete };

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        setHeight(Math.max(MIN_HEIGHT, editor.getContentHeight()));
        editor.onDidContentSizeChange(({ contentHeight }) => setHeight(Math.max(MIN_HEIGHT, contentHeight)));
        editor.onDidFocusEditorText(() => callbacks.current.onFocus());
        editor.onDidBlurEditorText(() => callbacks.current.onBlur?.());
        // Actions rather than commands: a command's keybinding goes to the last editor that added it.
        const runs: [string, number, CellRunMode][] = [
            ['run', monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, 'stay'],
            ['run-next', monaco.KeyMod.Shift | monaco.KeyCode.Enter, 'next'],
            ['run-insert', monaco.KeyMod.Alt | monaco.KeyCode.Enter, 'insert']
        ];
        for(const [id, keybinding, mode] of runs){
            editor.addAction({
                id: `volt-notebook-cell-${id}`,
                label: 'Run cell',
                keybindings: [keybinding],
                run: () => callbacks.current.onRun(mode)
            });
        }
        if(language === 'python'){
            registerCompletionProvider(monaco);
            const model = editor.getModel();
            if(model){
                const uri = model.uri.toString();
                completers.set(uri, (code, cursor) => callbacks.current.complete?.(code, cursor) ?? Promise.resolve({ matches: [], cursorStart: cursor, cursorEnd: cursor }));
                editor.onDidDispose(() => completers.delete(uri));
            }
        }
    };

    useEffect(() => {
        if(focusRequest !== 0){
            editorRef.current?.focus();
        }
    }, [focusRequest]);

    return (
        <Editor
            path={`notebook-cell-${cellId}.${language === 'python' ? 'py' : language === 'markdown' ? 'md' : 'txt'}`}
            height={height}
            language={language}
            value={value}
            theme={theme}
            options={OPTIONS}
            onChange={(next) => onChange(next ?? '')}
            onMount={handleMount}
            loading={null}
        />
    );
};

export default CellEditor;
