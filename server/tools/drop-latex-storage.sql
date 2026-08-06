-- Teardown for the removed LaTeX module.
--
-- NOT RUN AUTOMATICALLY, and deliberately so: this repo has no migrations
-- directory and `synchronize` is off in production (src/core/config/database.ts),
-- so nothing drops these tables for you and nothing will recreate them either.
-- Run it once per deployment, after a release that no longer contains the module.
--
-- Verify before running. These counts were 0 on the reference deployment, which is
-- what made the drop free; a non-zero count means someone used the feature and you
-- want an export first:
--
--   SELECT
--     (SELECT count(*) FROM latex_documents) AS documents,
--     (SELECT count(*) FROM latex_files)     AS files,
--     (SELECT count(*) FROM latex_assets)    AS assets,
--     (SELECT count(*) FROM catalog_folders WHERE kind = 'latex') AS folders;
--
-- Order matters: latex_files and latex_assets carry FKs onto latex_documents.

BEGIN;

DROP TABLE IF EXISTS latex_files;
DROP TABLE IF EXISTS latex_assets;
DROP TABLE IF EXISTS latex_documents;

DELETE FROM catalog_folders WHERE kind = 'latex';

COMMIT;

-- Object storage is not covered here. Each team cluster also holds a
-- `<BUCKET_PREFIX>volt-latex-assets` bucket (BUCKET_PREFIX is `cluster-` in the
-- desktop stack), which is no longer in the daemon's allowed-bucket list and so
-- will not be recreated. Remove it per cluster once the tables above are gone:
--
--   mc rb --force <alias>/cluster-volt-latex-assets
