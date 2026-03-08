import crud from './crud';
import binary from './binary';
import transfer from './transfer';
import execution from './execution';

export default {
    ...crud,
    ...binary,
    ...transfer,
    ...execution
};
