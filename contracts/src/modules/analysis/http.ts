// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:analysisId` path params) is NOT here.

// `retry failed frames` takes no client body — the analysis + team are path /
// server context. Provenance queries read from the query string. This module
// therefore has no client-sent body types.

export {};
