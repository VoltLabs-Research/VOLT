import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import BaseNode from '@/modules/plugin/components/plugin/atoms/BaseNode';
import './IfStatementNode.css';

const getConditionCount = (data: NodeProps['data']): number => {
    if (typeof data !== 'object' || data === null || !('ifStatement' in data)) {
        return 0;
    }

    const { ifStatement } = data;
    if (typeof ifStatement !== 'object' || ifStatement === null || !('conditions' in ifStatement)) {
        return 0;
    }

    return Array.isArray(ifStatement.conditions) ? ifStatement.conditions.length : 0;
};

const IfStatementNode = (props: NodeProps) => {
    const { data, id } = props;
    const conditionCount = getConditionCount(data);
    const branchSummaryId = `${id}-if-branch-summary`;
    const trueLabelId = `${id}-if-branch-true`;
    const falseLabelId = `${id}-if-branch-false`;

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.IF_STATEMENT}
            description={conditionCount > 0 ? `${conditionCount} condition(s)` : 'No conditions'}
        >
            <span id={branchSummaryId} className='plugin-accessible-status'>
                Upper output continues when the conditions evaluate true. Lower output continues when the conditions evaluate false.
            </span>
            <span id={trueLabelId} className='if-statement-branch-label if-statement-branch-label--true'>
                True
            </span>
            <Handle
                type='source'
                position={Position.Right}
                id='output-true'
                className='if-statement-handle if-statement-handle--true'
                style={{ top: '35%' }}
                aria-label='True branch output'
                aria-describedby={`${branchSummaryId} ${trueLabelId}`}
                title='Connect True branch'
            />
            <span id={falseLabelId} className='if-statement-branch-label if-statement-branch-label--false'>
                False
            </span>
            <Handle
                type='source'
                position={Position.Right}
                id='output-false'
                className='if-statement-handle if-statement-handle--false'
                style={{ top: '65%' }}
                aria-label='False branch output'
                aria-describedby={`${branchSummaryId} ${falseLabelId}`}
                title='Connect False branch'
            />
        </BaseNode>
    );
};

export default IfStatementNode;
