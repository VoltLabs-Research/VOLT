import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';

export interface ITeamJobProjectionService {
    upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot | null>;
}
