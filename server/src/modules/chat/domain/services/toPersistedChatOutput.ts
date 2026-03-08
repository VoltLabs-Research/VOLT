interface ChatEntity<TProps> {
    _id: string;
    props: TProps;
}

interface PersistedEntityIdentifier {
    _id: string;
}

export type PersistedEntityOutput<TProps> = TProps & PersistedEntityIdentifier;

export const toPersistedChatOutput = <TProps>(entity: ChatEntity<TProps>): PersistedEntityOutput<TProps> => {
    return {
        _id: entity._id,
        ...entity.props
    };
};
