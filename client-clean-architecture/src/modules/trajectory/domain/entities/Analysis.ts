export interface Analysis{
    _id: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
};
