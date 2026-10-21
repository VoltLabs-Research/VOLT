// CommonJS shape of the built-in: a plain mutable object, as packages that patch Node modules expect.
module.exports = require('./fs-promises.ts').default;
