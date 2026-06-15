import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { AnalysisProvenance } from '@/modules/analysis/contracts/provenance-types';

export const AnalysisProvenanceRecordedEvent = createDomainEvent<AnalysisProvenance>('analysis.provenance-recorded');
