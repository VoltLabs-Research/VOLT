// app-root-path's browser build reads require.main, which a bundle has none of; the backend runs from
// its working directory, as `node dist/...` does.
const root = process.cwd();
module.exports = { path: root, resolve: (target) => require('path').join(root, target), require: () => { throw new Error('app-root-path.require is not supported'); }, toString: () => root, setPath: () => {} };
