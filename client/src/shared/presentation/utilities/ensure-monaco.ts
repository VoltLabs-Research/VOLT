import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme } from '@/shared/presentation/utilities/app-theme';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import type * as Monaco from 'monaco-editor';

interface MonacoThemeTokens {
    background: string;
    surface: string;
    lineHighlight: string;
    selection: string;
    borderSoft: string;
    borderStrong: string;
    foreground: string;
    secondaryForeground: string;
    mutedForeground: string;
    accent: string;
    syntaxString: string;
    syntaxPrimitive: string;
    syntaxKey: string;
};

export enum MonacoThemeName {
    Light = 'volt-light',
    Dark = 'volt-dark'
};

let monacoSetupPromise: Promise<typeof Monaco> | null = null;

const MONACO_THEME_TOKENS: Record<Theme, MonacoThemeTokens> = {
    [Theme.Dark]: {
        background: '#101011',
        surface: '#171719',
        lineHighlight: '#ffffff0a',
        selection: '#ffffff0f',
        borderSoft: '#1D1D20',
        borderStrong: '#2B2B2E',
        foreground: '#f0f0f0',
        secondaryForeground: '#6F717B',
        mutedForeground: '#7e808b',
        accent: '#0062FF',
        syntaxString: '#86efac',
        syntaxPrimitive: '#fbbf24',
        syntaxKey: '#93c5fd'
    },
    [Theme.Light]: {
        background: '#ffffff',
        surface: '#f5f5f7',
        lineHighlight: '#0000000a',
        selection: '#00000014',
        borderSoft: '#00000014',
        borderStrong: '#c7c7cc',
        foreground: '#1d1d1f',
        secondaryForeground: '#4f4f4f',
        mutedForeground: '#8e8e93',
        accent: '#007aff',
        syntaxString: '#16a34a',
        syntaxPrimitive: '#d97706',
        syntaxKey: '#2563eb'
    }
};

const getMonacoTokenColor = (colorValue: string): string => {
    if (!colorValue.startsWith('#')) {
        return colorValue;
    }

    return colorValue.slice(1);
};

const buildMonacoTheme = (theme: Theme): Monaco.editor.IStandaloneThemeData => {
    const tokens = MONACO_THEME_TOKENS[theme];

    return {
        base: theme === Theme.Dark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [
            { token: 'comment', foreground: getMonacoTokenColor(tokens.secondaryForeground) },
            { token: 'string', foreground: getMonacoTokenColor(tokens.syntaxString) },
            { token: 'number', foreground: getMonacoTokenColor(tokens.syntaxPrimitive) },
            { token: 'keyword', foreground: getMonacoTokenColor(tokens.accent) },
            { token: 'type', foreground: getMonacoTokenColor(tokens.syntaxKey) },
            { token: 'delimiter', foreground: getMonacoTokenColor(tokens.secondaryForeground) }
        ],
        colors: {
            'editor.background': tokens.background,
            'editor.foreground': tokens.foreground,
            'editorCursor.foreground': tokens.accent,
            'editor.lineHighlightBackground': tokens.lineHighlight,
            'editor.selectionBackground': tokens.selection,
            'editor.inactiveSelectionBackground': tokens.lineHighlight,
            'editorLineNumber.foreground': tokens.mutedForeground,
            'editorLineNumber.activeForeground': tokens.foreground,
            'editorGutter.background': tokens.background,
            'editorIndentGuide.background1': tokens.borderSoft,
            'editorIndentGuide.activeBackground1': tokens.borderStrong,
            'editorWhitespace.foreground': tokens.borderSoft,
            'editorWidget.background': tokens.surface,
            'editorWidget.border': tokens.borderSoft,
            'input.background': tokens.surface,
            'input.foreground': tokens.foreground,
            'input.border': tokens.borderSoft,
            'focusBorder': tokens.accent,
            'minimap.background': tokens.background,
            'scrollbarSlider.background': tokens.lineHighlight,
            'scrollbarSlider.hoverBackground': tokens.selection,
            'scrollbarSlider.activeBackground': tokens.borderStrong
        }
    };
};

/** Registers the Volt Monaco light and dark themes. */
export const registerMonacoThemes = (monaco: typeof Monaco): void => {
    registerMonacoTheme(monaco, Theme.Light);
    registerMonacoTheme(monaco, Theme.Dark);
};

/** Resolves the Monaco theme name for the active application theme. */
export const getMonacoThemeName = (theme: Theme): MonacoThemeName => {
    return theme === Theme.Light ? MonacoThemeName.Light : MonacoThemeName.Dark;
};

/** Registers the Volt Monaco theme that matches the active application theme. */
export const registerMonacoTheme = (monaco: typeof Monaco, theme: Theme): void => {
    monaco.editor.defineTheme(getMonacoThemeName(theme), buildMonacoTheme(theme));
};

/**
 * Defers Monaco bootstrap until an editor route mounts, keeping the worker
 * graph out of the main application entry chunk.
 */
export const ensureMonaco = (): Promise<typeof Monaco> => {
    if (monacoSetupPromise) {
        return monacoSetupPromise;
    }

    monacoSetupPromise = import('monaco-editor').then((monaco: typeof Monaco) => {
        self.MonacoEnvironment = {
            getWorker(_, label) {
                if (label === 'json') {
                    return new jsonWorker();
                }

                if (label === 'css' || label === 'scss' || label === 'less') {
                    return new cssWorker();
                }

                if (label === 'html' || label === 'handlebars' || label === 'razor') {
                    return new htmlWorker();
                }

                if (label === 'typescript' || label === 'javascript') {
                    return new tsWorker();
                }

                return new editorWorker();
            }
        };

        loader.config({ monaco });
        registerMonacoThemes(monaco);

        return monaco;
    });

    return monacoSetupPromise;
};

/** Applies the active Volt Monaco theme to all mounted editors. */
export const applyMonacoTheme = (theme = getActiveAppTheme()): Promise<typeof Monaco> => {
    return ensureMonaco().then((monaco) => {
        registerMonacoTheme(monaco, theme);
        monaco.editor.setTheme(getMonacoThemeName(theme));

        return monaco;
    });
};
