import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';

export interface ExposureDescriptor {
    exposureId: string;
    exposureName: string;
    node: WorkflowNode;
};

export const getExposureNodes = (nodes: WorkflowNode[]): ExposureDescriptor[] => {
    const descriptors: ExposureDescriptor[] = [];

    for (const node of nodes) {
        if (node.type !== WorkflowNodeType.Exposure) continue;

        const exposureName = String(node.data?.exposure?.name || '').trim();
        if (!exposureName) continue;

        descriptors.push({
            exposureId: node.id,
            exposureName,
            node
        });
    }

    return descriptors;
};
