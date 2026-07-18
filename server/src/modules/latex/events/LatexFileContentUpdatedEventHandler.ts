import latexSocketModule from '@modules/latex/socket/LatexSocketModule';
import type LatexFileContentUpdatedEvent from '@modules/latex/events/LatexFileContentUpdatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class LatexFileContentUpdatedEventHandler implements IEventHandler<LatexFileContentUpdatedEvent> {
    async handle(event: LatexFileContentUpdatedEvent): Promise<void> {
        const { documentId, teamId, fileId, content } = event.payload;
        await latexSocketModule.applyAiContentToFile(documentId, teamId, fileId, content);
    }
}

const latexFileContentUpdatedEventHandler = new LatexFileContentUpdatedEventHandler();
subscribeHandler('latex-file.content.updated', latexFileContentUpdatedEventHandler);

export default latexFileContentUpdatedEventHandler;
