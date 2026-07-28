import { EntrypointType, NodeType } from '@volt/contracts/modules/plugin/domain/enums';
import type { NodeProps } from '@xyflow/react';
import type { IEntrypointData } from '@volt/contracts/modules/plugin/domain/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';

const EntrypointNode = (props: NodeProps) => {
    const { data } = props;
    const entrypoint = (data.entrypoint as IEntrypointData) || {};
    const entrypointType = entrypoint.type ?? EntrypointType.EXECUTABLE;

    const hasBinary = !!entrypoint.binary;
    const entrypointLabel = entrypointType === EntrypointType.PYTHON_SCRIPT
        ? 'Python script'
        : entrypointType === EntrypointType.PACKAGED_EXECUTABLE
            ? 'Packaged executable'
            : 'Executable';
    const binaryDisplay = hasBinary ? `${entrypointLabel}: ${entrypoint.binary || 'Binary attached'}` : undefined;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ENTRYPOINT}
            description={hasBinary ? binaryDisplay : 'No binary attached'}
        />
    );
};

export default EntrypointNode;
