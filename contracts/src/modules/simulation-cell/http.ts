// The simulation-cell module is read-only over HTTP: every endpoint is a `GET`
// with its inputs carried entirely in the path/query (`:teamId`,
// `:trajectoryId`, `:simulationCellId`, `?timestep`). The client therefore
// sends no request bodies, so there are no wire input types to declare here.

export {};
