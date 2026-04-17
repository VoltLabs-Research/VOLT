export type MsgpackScalar = boolean | null | number | string;
export type MsgpackValue = MsgpackScalar | MsgpackObject | MsgpackValue[];

export interface MsgpackObject {
    [key: string]: MsgpackValue | undefined;
}
