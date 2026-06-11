import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@modules/jobs/domain/contracts/TeamJobSnapshot';

export interface ITeamJobProjectionService {
    upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot | null>;
}
