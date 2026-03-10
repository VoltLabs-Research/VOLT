export interface PersistedEntity<TProps> {
    _id: string;
    props: TProps;
}

export type PersistedEntityOutput<TProps> = TProps & {
    _id: string;
};

export const toPersistedEntity = <TProps>(entity: PersistedEntity<TProps>): PersistedEntityOutput<TProps> => ({
    _id: entity._id,
    ...entity.props
});
