import crud from './crud';
import binary from './binary';
import transfer from './transfer';
import execution from './execution';
import teamClusters from './team-clusters';

export default {
    ...crud,
    ...binary,
    ...transfer,
    ...execution,
    ...teamClusters
};
