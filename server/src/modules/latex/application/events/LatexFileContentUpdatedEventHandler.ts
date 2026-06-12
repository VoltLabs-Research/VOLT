import LatexSocketModule from '@modules/latex/socket/LatexSocketModule';
import type LatexFileContentUpdatedEvent from '@modules/latex/domain/events/LatexFileContentUpdatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * Pushes an AI-authored LaTeX file edit into the live editing session so open
 * Monaco editors update without a reload. The content is already persisted to
 * Mongo by the use-case that published this event; this handler only handles
 * the LIVE delivery. If no editor has the file open there is no Yjs session and
 * this is a no-op (the next open loads the persisted content fresh).
 *
 * Injects the LatexSocketModule singleton by class (it is `@Singleton()` with no
 * token, so it registers under its own constructor) to reach the in-memory Yjs
 * sessions it owns.
 */
@Subscribe('latex-file.content.updated')
export default class LatexFileContentUpdatedEventHandler implements IEventHandler<LatexFileContentUpdatedEvent> {
    constructor(
        private readonly latexSocketModule: LatexSocketModule
    ) {}

    async handle(event: LatexFileContentUpdatedEvent): Promise<void> {
        const { documentId, teamId, fileId, content } = event.payload;
        await this.latexSocketModule.applyAiContentToFile(documentId, teamId, fileId, content);
    }
}
