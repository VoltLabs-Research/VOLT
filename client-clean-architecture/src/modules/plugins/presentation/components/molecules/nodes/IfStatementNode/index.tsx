import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import BaseNode from '@/modules/plugins/presentation/components/atoms/BaseNode';
import './IfStatementNode.css';

interface IIfStatementData {
    conditions?: unknown[];
}

const IfStatementNode = memo((props: NodeProps) => {
    const { data } = props;
    const ifData = (data as any).ifStatement as IIfStatementData | undefined;
    const conditionCount = ifData?.conditions?.length || 0;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.IF_STATEMENT}
            description={conditionCount > 0 ? `${conditionCount} condition(s)` : 'No conditions'}
        >
            <Handle
                type='source'
                position={Position.Right}
                id='output-true'
                className='if-statement-handle if-statement-handle--true'
                style={{ top: '35%' }}
            />
            <Handle
                type='source'
                position={Position.Right}
                id='output-false'
                className='if-statement-handle if-statement-handle--false'
                style={{ top: '65%' }}
            />
        </BaseNode>
    );
});

IfStatementNode.displayName = 'IfStatementNode';

export default IfStatementNode;
