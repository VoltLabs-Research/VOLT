import { WorkflowNodeData } from './WorkflowNodeData';
import { WorkflowNodeType } from '@shared/contracts/types/Plugin';

/**
 * Re-export shim. The canonical `WorkflowNodeType` runtime enum now lives in the
 * neutral contracts layer (`@shared/contracts/types/Plugin`) for the
 * detachable-modules migration — it is compared by value across module
 * boundaries (e.g. trajectory's `AtomPropertiesService`), so it is MOVED (a
 * duplicated string enum would be nominally distinct in TS). Existing importers
 * of this module path keep working unchanged.
 */
export { WorkflowNodeType };

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
}
