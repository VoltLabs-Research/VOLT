const LIKE_ESCAPE_CHARACTER = '\\';

type MemberColumn = 'participants' | 'admins';

/**
 * `participants` / `admins` are `simple-array` columns, so membership is a
 * substring match against the comma-delimited payload. Wrapping both the column
 * and the needle in commas keeps the match anchored to whole ids.
 */
export const memberToken = (userId: string): string =>
    `%,${userId.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`)},%`;

export const memberCondition = (column: MemberColumn, parameter: string): string =>
    `',' || COALESCE(chat.${column}, '') || ',' LIKE :${parameter} ESCAPE '${LIKE_ESCAPE_CHARACTER}'`;
