import latexSocketModule from '@modules/latex/socket/LatexSocketModule';
import type LatexFileContentUpdatedEvent from '@modules/latex/events/LatexFileContentUpdatedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('latex-file.content.updated')
export default class LatexFileContentUpdatedEventHandler implements IEventHandler<LatexFileContentUpdatedEvent> {
    async handle(event: LatexFileContentUpdatedEvent): Promise<void> {
        const { documentId, teamId, fileId, content } = event.payload;
        await latexSocketModule.applyAiContentToFile(documentId, teamId, fileId, content);
    }
}
