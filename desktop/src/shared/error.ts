export const errMessage = (err: unknown) => (err as any)?.message ?? String(err);
