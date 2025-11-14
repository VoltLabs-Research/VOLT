/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import App from './App.tsx'
import './assets/stylesheets/theme.css';
import './assets/stylesheets/general.css';

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
    },
};

loader.config({ monaco });

// Force dark mode if VITE_FORCE_DARK_MODE is set
if (import.meta.env.VITE_FORCE_DARK_MODE === 'true') {
    try {
        localStorage.setItem('theme', 'dark');
    } catch (e) {
        // Ignore localStorage errors
    }
}

// Theme bootstrap: set data-theme attribute based on localStorage or system preference
(() => {
    const root = document.documentElement;
    const apply = (mode: 'light' | 'dark') => root.setAttribute('data-theme', mode);
    const forceDarkMode = import.meta.env.VITE_FORCE_DARK_MODE === 'true';
    
    // Check localStorage first, then fall back to system preference
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (storedTheme) {
        apply(storedTheme);
    } else {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        apply(mq.matches ? 'light' : 'dark');
        // Only listen to system preference changes if dark mode is not forced
        if (!forceDarkMode) {
            mq.addEventListener?.('change', (e) => apply(e.matches ? 'light' : 'dark'));
        }
    }
    
    // Optional: expose quick toggle for future settings panel
    (window as any).__setTheme = (mode: 'light' | 'dark') => {
        // Prevent changing theme if dark mode is forced
        if (forceDarkMode && mode !== 'dark') return;
        localStorage.setItem('theme', mode);
        apply(mode);
    };
})();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
)
