import type { WhiteboardCreatedEventPayload } from '@modules/whiteboards/events/WhiteboardCreatedEvent';
import type { WhiteboardDeletedEventPayload } from '@modules/whiteboards/events/WhiteboardDeletedEvent';

declare global {
    interface EventMap {
        'whiteboard.created': WhiteboardCreatedEventPayload;
        'whiteboard.deleted': WhiteboardDeletedEventPayload;
    }
}
