import type { JobStatusChangedEventPayload } from '@modules/jobs/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';

export interface ITeamJobProjectionService {
    upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot | null>;
}
