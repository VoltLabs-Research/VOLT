export interface EntityProps{
    id: string;
    createdAt: Date;
    updatedAt: Date;
};

export default abstract class Entity<T extends EntityProps>{
    constructor(
        protected readonly props: T
    ){
        this.props = Object.freeze({ ...props });
    }

    equals(other: Entity<T>): boolean{
        if(other === null || other === undefined){
            return false;
        }

        if(!(other instanceof Entity)){
            return false;
        }

        return this.props.id === other.props.id;
    }
};