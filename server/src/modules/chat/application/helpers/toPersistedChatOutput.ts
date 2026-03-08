interface ChatEntity<TProps> {
    _id: string;
    props: TProps;
}

export const toPersistedChatOutput = <TProps>(entity: ChatEntity<TProps>): TProps & { _id: string } => {
    return {
        _id: entity._id,
        ...entity.props
    };
};
