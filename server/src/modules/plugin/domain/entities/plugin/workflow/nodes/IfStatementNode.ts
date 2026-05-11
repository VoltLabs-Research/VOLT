export enum IfStatementConditionType {
    And = 'and',
    Or = 'or'
}

export enum IfStatementConditionHandler {
    IsEqualTo = 'is_equal_to',
    IsNotEqualTo = 'is_not_equal_to'
}

export interface IfStatementCondition {
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
}

export interface IfStatementNodeData {
    conditions: IfStatementCondition[];
}
