import LatexFileService from '@modules/latex/services/LatexFileService';
import logger from '@shared/infrastructure/logger';
import * as Y from 'yjs';

const PERSIST_DEBOUNCE_MS = 500;
const LATEX_Y_TEXT_NAME = 'content';
const SERVER_INIT_ORIGIN = 'server:init';
const AI_ORIGIN: unique symbol = Symbol('latex:ai');

export interface LatexFileSession {
    documentId: string;
    teamId: string;
    fileId: string;
    doc: Y.Doc;
    text: Y.Text;
}

interface TextSplice {
    index: number;
    deleteCount: number;
    insertText: string;
}

type LatexFileSessionBroadcast = (session: LatexFileSession, update: Uint8Array, origin: unknown) => void;

const computeTextSplice = (currentText: string, nextText: string): TextSplice => {
    let prefixLength = 0;
    const minLength = Math.min(currentText.length, nextText.length);

    while (
        prefixLength < minLength
        && currentText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)
    ) {
        prefixLength += 1;
    }

    let currentSuffixIndex = currentText.length - 1;
    let nextSuffixIndex = nextText.length - 1;
    while (
        currentSuffixIndex >= prefixLength
        && nextSuffixIndex >= prefixLength
        && currentText.charCodeAt(currentSuffixIndex) === nextText.charCodeAt(nextSuffixIndex)
    ) {
        currentSuffixIndex -= 1;
        nextSuffixIndex -= 1;
    }

    return {
        index: prefixLength,
        deleteCount: currentSuffixIndex - prefixLength + 1,
        insertText: nextText.slice(prefixLength, nextSuffixIndex + 1)
    };
};

const buildSessionKey = (documentId: string, fileId: string): string => `${documentId}:${fileId}`;

export default class LatexFileSessionStore {
    #files = new LatexFileService();

    #sessions = new Map<string, LatexFileSession>();

    #saveTimers = new Map<string, NodeJS.Timeout>();

    #broadcast: LatexFileSessionBroadcast;

    constructor(broadcast: LatexFileSessionBroadcast) {
        this.#broadcast = broadcast;
    }

    async acquire(documentId: string, teamId: string, fileId: string): Promise<LatexFileSession | null> {
        const key = buildSessionKey(documentId, fileId);
        const existing = this.#sessions.get(key);
        if (existing) {
            return existing.teamId === teamId ? existing : null;
        }

        const files = await this.#files.listFiles({
            teamId,
            documentId
        }).catch((error: unknown) => {
            logger.warn(`@latex-socket - failed to load files for document ${documentId}: ${(error as Error).message}`);
            return null;
        });

        const file = files?.find((candidate) => candidate._id === fileId);
        if (!file) {
            return null;
        }

        const doc = new Y.Doc();
        const text = doc.getText(LATEX_Y_TEXT_NAME);
        if (file.content) {
            doc.transact(() => {
                text.insert(0, file.content);
            }, SERVER_INIT_ORIGIN);
        }

        const session: LatexFileSession = {
            documentId,
            teamId,
            fileId,
            doc,
            text
        };

        doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === SERVER_INIT_ORIGIN) {
                return;
            }

            this.#broadcast(session, update, origin);

            if (origin === AI_ORIGIN) {
                return;
            }

            this.schedulePersist(documentId, teamId, fileId, text.toString());
        });

        this.#sessions.set(key, session);
        return session;
    }

    async release(documentId: string, fileId: string): Promise<void> {
        const key = buildSessionKey(documentId, fileId);
        const session = this.#sessions.get(key);
        if (!session) {
            return;
        }

        this.#cancelPersist(key);
        await this.#persistContent(session.documentId, session.teamId, session.fileId, session.text.toString());
        session.doc.destroy();
        this.#sessions.delete(key);
    }

    schedulePersist(documentId: string, teamId: string, fileId: string, content: string): void {
        const key = buildSessionKey(documentId, fileId);
        this.#cancelPersist(key);

        const timer = setTimeout(() => {
            this.#saveTimers.delete(key);
            this.#persistContent(documentId, teamId, fileId, content);
        }, PERSIST_DEBOUNCE_MS);

        this.#saveTimers.set(key, timer);
    }

    async applyAiContent(documentId: string, teamId: string, fileId: string, content: string): Promise<void> {
        const session = this.#sessions.get(buildSessionKey(documentId, fileId));
        if (!session || session.teamId !== teamId) {
            return;
        }

        const currentText = session.text.toString();
        if (currentText === content) {
            return;
        }

        const splice = computeTextSplice(currentText, content);
        session.doc.transact(() => {
            if (splice.deleteCount > 0) {
                session.text.delete(splice.index, splice.deleteCount);
            }
            if (splice.insertText.length > 0) {
                session.text.insert(splice.index, splice.insertText);
            }
        }, AI_ORIGIN);
    }

    async flush(): Promise<void> {
        await Promise.all(Array.from(this.#sessions.values()).map((session) => (
            this.#persistContent(session.documentId, session.teamId, session.fileId, session.text.toString())
        )));

        for (const timer of this.#saveTimers.values()) {
            clearTimeout(timer);
        }
        this.#saveTimers.clear();
        this.#sessions.clear();
    }

    #cancelPersist(key: string): void {
        const timer = this.#saveTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.#saveTimers.delete(key);
        }
    }

    async #persistContent(documentId: string, teamId: string, fileId: string, content: string): Promise<void> {
        try {
            await this.#files.updateFile({
                teamId,
                documentId,
                fileId,
                content
            });
        } catch (error) {
            logger.error(`@latex-socket - auto-save error for document ${documentId}: ${error}`);
        }
    }
}
