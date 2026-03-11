import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/latex/application/events/TeamDeletedEventHandler';
import LatexDocumentDeletedEventHandler from '@modules/latex/application/events/LatexDocumentDeletedEventHandler';

export const latexSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'latex-document.deleted': LatexDocumentDeletedEventHandler
};
