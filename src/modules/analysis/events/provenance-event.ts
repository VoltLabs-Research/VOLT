import { createDomainEvent } from '@shared/domain/events/createDomainEvent';
import type { AnalysisProvenance } from '@modules/analysis/services/provenance-types';

export const AnalysisProvenanceRecordedEvent = createDomainEvent<AnalysisProvenance>('analysis.provenance-recorded');
