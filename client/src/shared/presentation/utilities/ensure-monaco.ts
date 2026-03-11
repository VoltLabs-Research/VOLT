import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import type * as Monaco from 'monaco-editor';

let monacoSetupPromise: Promise<void> | null = null;

/**
 * Defers Monaco bootstrap until an editor route mounts, keeping the worker
 * graph out of the main application entry chunk.
 */
export const ensureMonaco = () => {
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
    });

    return monacoSetupPromise;
};
