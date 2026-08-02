import type { WhiteboardEventPayload } from '@modules/whiteboards/contracts/events';

declare global {
    interface EventMap {
        'whiteboard.created': WhiteboardEventPayload;
        'whiteboard.deleted': WhiteboardEventPayload;
    }
}
