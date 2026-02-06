export enum IfStatementConditionType {
    And = 'and',
    Or = 'or'
};

export enum IfStatementConditionHandler {
    IsEqualTo = 'is_equal_to',  // Changed from 'is-equal-to' to match legacy format
    IsNotEqualTo = 'is_not_equal_to'  // Changed from 'is-not-equal-to' to match legacy format
};

export interface IfStatementCondition {
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
};

export interface IfStatementNodeData {
    conditions: IfStatementCondition[];
};