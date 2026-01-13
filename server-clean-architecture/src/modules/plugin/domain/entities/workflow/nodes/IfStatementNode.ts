export enum IfStatementConditionType{
    And = 'and',
    Or = 'or'
};

export enum IfStatementConditionHandler{
    IsEqualTo = 'is-equal-to',
    IsNotEqualTo = 'is-not-equal-to'
};

export interface IfStatementCondition{
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
};

export interface IfStatementNodeData{
    conditions: IfStatementCondition[];
};