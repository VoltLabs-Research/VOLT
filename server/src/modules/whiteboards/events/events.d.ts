import type {
    WhiteboardCreatedEventPayload,
    WhiteboardDeletedEventPayload
} from '@modules/whiteboards/contracts/events';

declare global {
    interface EventMap {
        'whiteboard.created': WhiteboardCreatedEventPayload;
        'whiteboard.deleted': WhiteboardDeletedEventPayload;
    }
}
