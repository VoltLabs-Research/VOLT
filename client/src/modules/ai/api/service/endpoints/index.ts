import crud from './crud';
import messages from './messages';
import stream from './stream';

export default {
    ...crud,
    ...messages,
    ...stream
};
