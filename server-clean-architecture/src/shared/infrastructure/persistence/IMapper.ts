export interface IMapper<TDomain, TProps, TDocument>{
    toDomain(raw: TDocument): TDomain;
    toPersistence(domain: TDomain | TProps): any;
};

