import { EntrypointType, NodeType } from '@volt/contracts/modules/plugin/enums';
import type { NodeProps } from '@xyflow/react';
import type { IEntrypointData } from '@volt/contracts/modules/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';

const EntrypointNode = (props: NodeProps) => {
    const { data } = props;
    const entrypoint = (data.entrypoint as IEntrypointData) || {};
    const entrypointType = entrypoint.type ?? EntrypointType.EXECUTABLE;

    const entrypointLabel = entrypointType === EntrypointType.PYTHON_SCRIPT
        ? 'Python script'
        : entrypointType === EntrypointType.PACKAGED_EXECUTABLE
            ? 'Packaged executable'
            : 'Executable';

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.ENTRYPOINT}
            description={entrypoint.binary ? `${entrypointLabel}: ${entrypoint.binary}` : 'No binary attached'}
        />
    );
};

export default EntrypointNode;
