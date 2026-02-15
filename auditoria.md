# Volt Server -- Full Codebase Bug Audit

**Date:** 2026-02-14
**Scope:** `/server/src/` -- all modules, shared infrastructure, core, and server entry point
**Base path:** `/home/rodyherrera/Desktop/_/REFACTOR/X/VOLT_ALGORITHMS/Volt`

---

## Summary

| Module | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| Plugin | 3 | 5 | 5 | 5 | **18** |
| Analysis | 3 | 3 | 5 | 5 | **16** |
| Shared Infrastructure | 3 | 6 | 12 | 6 | **27** |
| Auth | 1 | 2 | 2 | 3 | **8** |
| Team | 0 | 7 | 1 | 0 | **8** |
| Core & Server Startup | 2 | 10 | 11 | 5 | **28** |
| Container | 2 | 3 | 6 | 2 | **13** |
| Trajectory | 0 | 2 | 3 | 5 | **10** |
| Chat | 1 | 0 | 2 | 1 | **4** |
| SSH | 0 | 1 | 0 | 0 | **1** |
| API Tracker | 2 | 1 | 1 | 0 | **4** |
| Simulation Cell | 0 | 1 | 3 | 3 | **7** |
| **TOTAL** | **17** | **41** | **51** | **35** | **144** |

---

## Top 10 Most Critical Bugs

| # | Module | File | Line | Issue |
|---|--------|------|------|-------|
| 1 | Core | `server.ts` | 48-54 | Server accepts connections before DB/Redis/MinIO ready |
| 2 | Core | `server.ts` | 22-24 | No graceful shutdown -- process.exit(0) without cleanup |
| 3 | Plugin | `ProcessExecutorService.ts` | 20 | Missing `await` on `fs.access()` -- binary check is dead code |
| 4 | Plugin | `AnalysisWorker.ts` | 152-169 | Race condition in `updateProgress` -- lost counter updates |
| 5 | Plugin | `AnalysisWorker.ts` | 141-142 | Timestep `0` treated as falsy -- wrong frame resolution |
| 6 | Analysis | `CreateAnalysisUseCase.ts` | 10 | DI token mismatch (`string` vs `Symbol`) -- runtime crash |
| 7 | Analysis | `CreateAnalysisUseCase.ts` | 16 | Passes slug string where ObjectId is required |
| 8 | Shared | `authentication.ts` | 37 | `jwt.verify()` without try/catch -- crashes on invalid tokens |
| 9 | Shared | `crypto.ts` | 17, 26 | Random salt generated but never used -- static key derivation |
| 10 | Shared | `FileExtractorService.ts` | 24-26 | Zip Slip vulnerability -- no path validation on extraction |

---

# Module: Plugin

**Path:** `server/src/modules/plugin/`

---

### PLUGIN-001 [Critical] Missing `await` on `fs.access()` -- binary permission check bypassed

```
FILE: server/src/modules/plugin/infrastructure/services/ProcessExecutorService.ts
LINE: 20
SEVERITY: Critical
CATEGORY: Async/Await
DESCRIPTION: fs.access(path, fs.constants.X_OK) is called WITHOUT await. Since fs is imported
from node:fs/promises, this returns a Promise that is never awaited. The surrounding try/catch
will never catch a rejection -- the access check is completely meaningless and the method always
proceeds as if the binary is executable/accessible. A missing or non-executable binary will not
be caught here; the error will surface later as an obscure spawn failure.
```

### PLUGIN-002 [Critical] Race condition in `updateProgress` -- lost updates on concurrent workers

```
FILE: server/src/modules/plugin/infrastructure/workers/AnalysisWorker.ts
LINE: 152-169
SEVERITY: Critical
CATEGORY: Concurrency / Data Integrity
DESCRIPTION: updateProgress performs a non-atomic read-modify-write cycle: it calls findById to
read the current completedFrames value, increments it in memory, then calls updateById to write
it back. When multiple workers process jobs for the same analysis concurrently, they can read the
same completedFrames value simultaneously, each increment it to the same number, and write it
back -- causing lost updates. This means completedFrames will undercount, progress percentage
will be wrong, and the analysis may never reach 100% and thus never be marked as "completed".
Fix: use an atomic $inc operation instead of read-modify-write.
```

### PLUGIN-003 [Critical] Falsy-zero bug in `resolveJobTimestep` -- timestep 0 silently skipped

```
FILE: server/src/modules/plugin/infrastructure/workers/AnalysisWorker.ts
LINE: 141-142
SEVERITY: Critical
CATEGORY: Logic Error
DESCRIPTION: Lines 141-142 use logical AND (&&) in an OR (||) chain:
  job.input.timestep || (item && item.timestep) || (item && item.frame) || forEachIndex || 0
If timestep or frame is 0 (a perfectly valid frame number), the && expression evaluates to 0
which is falsy, causing it to be skipped and falling through to forEachIndex or the default 0.
This means timestep 0 may resolve to an incorrect value depending on forEachIndex. Fix: use
nullish coalescing (??) or explicit undefined checks instead of truthiness checks.
```

### PLUGIN-004 [High] Use case returns stale (pre-update) data

```
FILE: server/src/modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase.ts
LINE: 77
SEVERITY: High
CATEGORY: Stale Data
DESCRIPTION: The method returns plugin.props, but plugin was fetched at line 27 (before the
update). Line 75 calls updateById to persist the changes, but the returned object still
reflects the old state. The caller (e.g., the HTTP controller) receives stale data that does
not include the changes just saved. Fix: re-fetch the plugin after the update, or return the
updated entity.
```

### PLUGIN-005 [High] Pagination parameters hardcoded, ignoring user input

```
FILE: server/src/modules/plugin/application/use-cases/plugin/ListPluginsUseCase.ts
LINE: 17-18
SEVERITY: High
CATEGORY: Logic Error
DESCRIPTION: page is hardcoded to 1 and limit is hardcoded to 100, completely ignoring
input.page and input.limit from the DTO (which declares page: number and limit: number).
All consumers always receive the first page of up to 100 results regardless of what they
request. Pagination is entirely broken.
```

### PLUGIN-006 [High] Binary hash verification stubbed out -- corrupted cache served

```
FILE: server/src/modules/plugin/infrastructure/services/PluginBinaryCacheService.ts
LINE: 110-118
SEVERITY: High
CATEGORY: Security / Data Integrity
DESCRIPTION: The isValidBinary method accepts an expectedHash parameter but has a TODO
comment at line 114 and always returns true without verifying the hash. The hash check in
resolveBinary (lines 71-76) only runs on fresh downloads, not on cache hits. A corrupted
or tampered cached binary will be served without any detection.
```

### PLUGIN-007 [High] Worker path uses `.ts` extension -- breaks in production

```
FILE: server/src/modules/plugin/infrastructure/queues/AnalysisProcessingQueue.ts
LINE: 41
SEVERITY: High
CATEGORY: Environment / Deployment
DESCRIPTION: The worker file path is constructed with the literal filename
'AnalysisWorker.ts'. In a production environment where TypeScript is compiled to JavaScript,
this path would point to a non-existent .ts file, causing worker instantiation to fail.
```

### PLUGIN-008 [High] `updateEntrypoint` called on plain object, not Workflow entity

```
FILE: server/src/modules/plugin/infrastructure/services/PluginStorageService.ts
LINE: 230
SEVERITY: High
CATEGORY: Runtime Error
DESCRIPTION: After import, updateEntrypoint is called on newPlugin.props.workflow, but at
that point workflow is a plain object (deserialized from storage/DB), not a Workflow entity
instance with methods. Calling updateEntrypoint on it will throw a "not a function" TypeError
at runtime, crashing the import flow.
```

### PLUGIN-009 [Medium] Null check misses `undefined`

```
FILE: server/src/modules/plugin/infrastructure/services/nodes/handlers/EntrypointHandler.ts
LINE: 98
SEVERITY: Medium
CATEGORY: Logic Error
DESCRIPTION: The check is item === null, but output?.currentValue will typically be undefined
(not null) when unset. Since undefined !== null, the check passes and execution proceeds with
undefined as the item, likely causing downstream errors. Should use item == null or
item === null || item === undefined.
```

### PLUGIN-010 [Medium] Loose equality operators cause unexpected type coercion

```
FILE: server/src/modules/plugin/infrastructure/services/nodes/handlers/IfStatementHandler.ts
LINE: 37
SEVERITY: Medium
CATEGORY: Logic Error
DESCRIPTION: Uses == and != for comparisons instead of === and !==. This causes unexpected
type coercion: 0 == "" is true, null == undefined is true. In a workflow conditional node,
this could cause branches to be taken incorrectly, leading to wrong analysis results.
```

### PLUGIN-011 [Medium] `findParentByType` only checks first parent edge

```
FILE: server/src/modules/plugin/domain/entities/workflow/Workflow.ts
LINE: 139-140
SEVERITY: Medium
CATEGORY: Logic Error
DESCRIPTION: findParentByType uses .find() on incomingEdges, which returns only the first
match. For nodes with multiple incoming edges, this may miss the correct parent of the
requested type. If the first incoming edge leads to a node of a different type, the method
returns undefined even though a valid parent of the target type exists on another edge.
```

### PLUGIN-012 [Medium] No error handling in GLB controller -- unhandled promise rejection

```
FILE: server/src/modules/plugin/infrastructure/http/controllers/exposure/GetPluginExposureGLBController.ts
LINE: 15-28
SEVERITY: Medium
CATEGORY: Error Handling
DESCRIPTION: The controller has no try/catch block and does not call next(error). If the
storage service throws (e.g., file not found, permission denied), the promise rejection is
unhandled. The request will hang or crash the process depending on the Express version.
```

### PLUGIN-013 [Medium] Direct mutation of shared metadata context object

```
FILE: server/src/modules/plugin/infrastructure/utilities/listing-resolver.ts
LINE: 75-76
SEVERITY: Medium
CATEGORY: Side Effect / Data Integrity
DESCRIPTION: The resolver mutates metadata._resolvedContext.analysis.createdAt directly.
Since metadata is a shared object passed through the resolution pipeline, this side-effect
modifies state visible to other resolvers or callers, potentially causing unexpected behavior
in downstream logic that reads createdAt.
```

### PLUGIN-014 [Low] Typo in validation error message

```
FILE: server/src/modules/plugin/infrastructure/services/nodes/WorkflowValidator.ts
LINE: 41
SEVERITY: Low
CATEGORY: Typo
DESCRIPTION: Error message reads 'Workflow mus thave an Entrypoint mode' -- should be
'Workflow must have an Entrypoint node'. Two typos: "mus thave" (missing space) and "mode"
(should be "node").
```

### PLUGIN-015 [Low] Debug console.log/console.error statements left in production

```
FILE: server/src/modules/plugin/infrastructure/services/nodes/handlers/ExposureHandler.ts
LINE: 77, 114, 119-121, 155, 158, 160, 163-164, 167
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: Numerous console.log and console.error debug statements pollute production
logs, may leak sensitive data (object paths, frame data), and indicate incomplete cleanup.
```

### PLUGIN-016 [Low] Debug console.log left in ExportHandler

```
FILE: server/src/modules/plugin/infrastructure/services/nodes/handlers/ExportHandler.ts
LINE: 90, 100
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: console.log('EXPORT HANDLER===', objectPath) and console.log('ERROR:', err)
are debug statements left in production code.
```

### PLUGIN-017 [Low] Unused IEventBus dependency injection

```
FILE: server/src/modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase.ts
LINE: 15-16
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: IEventBus is injected via constructor but never referenced in the class body.
Event publishing is handled in the repository layer instead.
```

### PLUGIN-018 [Low] Typo in comment

```
FILE: server/src/modules/plugin/infrastructure/services/PluginWorkflowEngine.ts
LINE: 18
SEVERITY: Low
CATEGORY: Typo
DESCRIPTION: Comment says "paralleism" -- should be "parallelism".
```

---

# Module: Analysis

**Path:** `server/src/modules/analysis/`

---

### ANALYSIS-001 [Critical] DI token mismatch -- string vs Symbol

```
FILE: server/src/modules/analysis/application/use-cases/CreateAnalysisUseCase.ts
LINE: 10
SEVERITY: Critical
CATEGORY: Dependency Injection
DESCRIPTION: Uses the string literal 'IAnalysisRepository' as the DI token, but the container
registers the repository under Symbol.for('AnalysisRepository') via
ANALYSIS_TOKENS.AnalysisRepository. A string and a Symbol are never equal, so tsyringe will
fail to resolve the dependency at runtime.
```

### ANALYSIS-002 [Critical] Passes slug string where ObjectId is expected

```
FILE: server/src/modules/analysis/application/use-cases/CreateAnalysisUseCase.ts
LINE: 16
SEVERITY: Critical
CATEGORY: Data Integrity
DESCRIPTION: Passes input.pluginSlug (a human-readable slug string, e.g. "rmsd-analysis") as
the value for the 'plugin' field. The Mongoose schema defines 'plugin' as Schema.Types.ObjectId
with ref 'Plugin' and required: true. Mongoose will throw a CastError, or if it somehow passes,
store corrupt data that cannot be populated.
```

### ANALYSIS-003 [Critical] Same DI token mismatch in UpdateAnalysisByIdUseCase

```
FILE: server/src/modules/analysis/application/use-cases/UpdateAnalysisByIdUseCase.ts
LINE: 12
SEVERITY: Critical
CATEGORY: Dependency Injection
DESCRIPTION: Same bug as ANALYSIS-001. Uses the string literal 'IAnalysisRepository' instead of
ANALYSIS_TOKENS.AnalysisRepository (a Symbol). Runtime crash on DI resolution.
```

### ANALYSIS-004 [High] TrajectoryDeletedEventHandler -- deleteMany skips domain events

```
FILE: server/src/modules/analysis/application/events/TrajectoryDeletedEventHandler.ts
LINE: 16
SEVERITY: High
CATEGORY: Domain Event Skipping
DESCRIPTION: Calls this.analysisRepository.deleteMany({ trajectory: trajectoryId }) which uses
base MongooseBaseRepository.deleteMany (this.model.deleteMany(filter)), bypassing the overridden
deleteById in AnalysisRepository that publishes AnalysisDeletedEvent. ExposureMeta and ListingRow
records associated with deleted analyses are orphaned permanently.
```

### ANALYSIS-005 [High] TeamDeletedEventHandler -- same deleteMany issue

```
FILE: server/src/modules/analysis/application/events/TeamDeletedEventHandler.ts
LINE: 16
SEVERITY: High
CATEGORY: Domain Event Skipping
DESCRIPTION: Same issue as ANALYSIS-004. Calls deleteMany({ team: teamId }), bypassing event
publication. ExposureMeta and ListingRow records orphaned on team deletion.
```

### ANALYSIS-006 [High] Mapper missing 'team' in relation keys

```
FILE: server/src/modules/analysis/infrastructure/persistence/mongo/mappers/AnalysisMapper.ts
LINE: 7-11
SEVERITY: High
CATEGORY: Mapper Defect
DESCRIPTION: Relation keys array is ['createdBy', 'trajectory', 'plugin'] but omits 'team'.
When an Analysis document is mapped to domain and 'team' is NOT populated, the team field
remains a raw Mongoose ObjectId instead of being converted to string, causing type mismatches.
```

### ANALYSIS-007 [Medium] Missing required fields in create call

```
FILE: server/src/modules/analysis/application/use-cases/CreateAnalysisUseCase.ts
LINE: 14-22
SEVERITY: Medium
CATEGORY: Data Integrity
DESCRIPTION: The call to analysisRepository.create() does not include 'status' or 'clusterId'.
While 'status' has a schema default, 'clusterId' has no default and will be undefined despite
being declared required in the domain entity.
```

### ANALYSIS-008 [Medium] pluginId not converted to string in event payload

```
FILE: server/src/modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository.ts
LINE: 33
SEVERITY: Medium
CATEGORY: Data Type Inconsistency
DESCRIPTION: When publishing AnalysisDeletedEvent, line 32 correctly converts trajectory to
string with .toString(), but line 33 passes pluginId: result.plugin without calling .toString().
Passes a Mongoose ObjectId where a string is expected.
```

### ANALYSIS-009 [Medium] retryFailedFrames method is a stub

```
FILE: server/src/modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository.ts
LINE: 23-24
SEVERITY: Medium
CATEGORY: Incomplete Implementation
DESCRIPTION: The retryFailedFrames method has an empty body. The interface declares it, the
client calls it, yet the server implementation does nothing. The retry-failed-frames feature
is completely non-functional.
```

### ANALYSIS-010 [Medium] AnalysisRelations type missing 'plugin'

```
FILE: server/src/modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel.ts
LINE: 5
SEVERITY: Medium
CATEGORY: Type Definition
DESCRIPTION: AnalysisRelations = 'trajectory' | 'createdBy' | 'team' does not include
'plugin', even though the schema defines plugin as Schema.Types.ObjectId with ref 'Plugin'.
The Persistable type won't correctly type the plugin field as ObjectId.
```

### ANALYSIS-011 [Medium] Missing routes for CreateAnalysis and UpdateAnalysis controllers

```
FILE: server/src/modules/analysis/infrastructure/http/routes/analysis-routes.ts
LINE: 1-30
SEVERITY: Medium
CATEGORY: Dead Code
DESCRIPTION: The routes file does NOT register CreateAnalysisController or
UpdateAnalysisByIdController. No POST or PUT/PATCH routes exist. Both controllers and use
cases exist but are completely unreachable via HTTP -- dead code.
```

### ANALYSIS-012 [Low] Text index on ObjectId field

```
FILE: server/src/modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel.ts
LINE: 59
SEVERITY: Low
CATEGORY: Database
DESCRIPTION: Creates a text index on the 'plugin' field which is Schema.Types.ObjectId, not
String. A text index on an ObjectId field is functionally useless. Wastes storage and write
performance for zero benefit.
```

### ANALYSIS-013 [Low] Dead event file with mismatched name

```
FILE: server/src/modules/analysis/domain/events/AnalysisExecutionEvent.ts
LINE: 1-23
SEVERITY: Low
CATEGORY: Dead Code
DESCRIPTION: File is named AnalysisExecutionEvent.ts but exports AnalysisRequestedEvent.
Class is never instantiated anywhere. Dead code with a misleading filename.
```

### ANALYSIS-014 [Low] Unused import in GetAnalysisByIdUseCase

```
FILE: server/src/modules/analysis/application/use-cases/GetAnalysisByIdUseCase.ts
LINE: 8
SEVERITY: Low
CATEGORY: Code Quality
DESCRIPTION: Imports DeleteAnalysisByIdInputDTO but never uses it. Leftover from copy-paste.
```

### ANALYSIS-015 [Low] Domain leakage -- injecting _id into domain output

```
FILE: server/src/modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase.ts
LINE: 24-27
SEVERITY: Low
CATEGORY: Architecture
DESCRIPTION: Mapping logic mutates cloned props by injecting '_id' (props._id = analysis.id).
The AnalysisProps interface does not have an '_id' field. Leaks persistence-level naming into
domain output.
```

### ANALYSIS-016 [Low] Empty DTO file

```
FILE: server/src/modules/analysis/application/dtos/RetryFailedFramesDTO.ts
LINE: 1
SEVERITY: Low
CATEGORY: Dead Code
DESCRIPTION: File is completely empty. Placeholder for the retry-failed-frames feature that
was never implemented (matches the empty retryFailedFrames method in ANALYSIS-009).
```

---

# Module: Shared Infrastructure

**Path:** `server/src/shared/`

---

### SHARED-001 [Critical] jwt.verify() without try/catch -- crashes on invalid tokens

```
FILE: server/src/shared/infrastructure/http/middleware/authentication.ts
LINE: 37
SEVERITY: Critical
CATEGORY: Error Handling / Security
DESCRIPTION: jwt.verify() is called without any try/catch. If the token is expired, malformed,
or signed with the wrong key, jwt.verify() throws a synchronous exception. Because the
middleware is async and this throw is not caught, it will propagate as an unhandled rejection,
bypassing the structured 401 error response and crashing the request. Every request with an
invalid or expired Bearer token triggers this crash path.
```

### SHARED-002 [Critical] Salt generated but never used in key derivation

```
FILE: server/src/shared/infrastructure/utilities/crypto.ts
LINE: 17, 26, 58-61
SEVERITY: Critical
CATEGORY: Cryptography / Security
DESCRIPTION: In encrypt() (line 26), a random 64-byte salt is generated, but it is never
passed to the key derivation function. getEncryptionKey() (line 17) always derives the key
using the hardcoded static string 'Volt-ssh' as the salt parameter to crypto.scryptSync(),
completely ignoring the random salt. The random salt is stored in the output and parsed back
in decrypt(), but never used in decryption either. All encryptions use the identical derived
key, defeating the purpose of salted key derivation.
```

### SHARED-003 [Critical] Zip Slip vulnerability -- directory traversal on extraction

```
FILE: server/src/shared/infrastructure/services/FileExtractorService.ts
LINE: 24-26
SEVERITY: Critical
CATEGORY: Security / Path Traversal
DESCRIPTION: The zip file is extracted directly to workingDir using
unzipper.Extract({ path: workingDir }) with no validation of entry paths inside the archive.
A malicious zip file can contain entries with paths like "../../etc/cron.d/malicious" which
will be written outside the intended directory. Classic "Zip Slip" vulnerability
(CVE-2018-1002200).
```

### SHARED-004 [High] Race condition in TempFileService constructor (async in constructor)

```
FILE: server/src/shared/infrastructure/services/TempFileService.ts
LINE: 12-15
SEVERITY: High
CATEGORY: Race Condition / Initialization
DESCRIPTION: The constructor calls this.initialize(), which is async. Since constructors
cannot be async, the returned Promise is silently discarded (fire-and-forget). Any code using
the service immediately after construction may execute before the TEMP_DIR has been created,
causing ENOENT errors.
```

### SHARED-005 [High] TempFileService.delete() path traversal via TOCTOU

```
FILE: server/src/shared/infrastructure/services/TempFileService.ts
LINE: 58-59, 64
SEVERITY: High
CATEGORY: Security / TOCTOU
DESCRIPTION: On line 58, the path is resolved and checked against TEMP_DIR. On line 64,
fs.rm() is called with the *original* targetPath, not resolvedPath. If targetPath contains
symlinks, the resolved path may pass the boundary check, but actual deletion follows symlinks
outside the temp directory.
```

### SHARED-006 [High] Worker exits on DB connection failure without retry

```
FILE: server/src/shared/infrastructure/workers/BaseWorker.ts
LINE: 49-55
SEVERITY: High
CATEGORY: Reliability
DESCRIPTION: connectDB() catches database connection errors and only logs them, then
continues. The worker proceeds to process jobs without a database connection, causing every
DB-dependent operation to fail. No retry logic, no re-throw.
```

### SHARED-007 [High] Worker process.exit(1) kills entire process, not just thread

```
FILE: server/src/shared/infrastructure/workers/BaseWorker.ts
LINE: 17-26
SEVERITY: High
CATEGORY: Process Management
DESCRIPTION: Both uncaughtException and unhandledRejection handlers call process.exit(1).
In a worker_threads context, process.exit() terminates the entire Node.js process, not just
the worker thread. Any unhandled exception in a single worker kills the main process and all
other workers.
```

### SHARED-008 [High] No file size limit on multer uploads

```
FILE: server/src/shared/infrastructure/http/middleware/upload.ts
LINE: 9-12
SEVERITY: High
CATEGORY: Security / Denial of Service
DESCRIPTION: Multer uses memoryStorage with no limits. No fileSize limit, no files count
limit. An attacker can upload arbitrarily large files held entirely in memory, enabling
trivial denial-of-service by exhausting server memory.
```

### SHARED-009 [High] fileFilter accepts all files without validation

```
FILE: server/src/shared/infrastructure/http/middleware/upload.ts
LINE: 5-7
SEVERITY: High
CATEGORY: Security / Input Validation
DESCRIPTION: fileFilter unconditionally accepts every file by calling cb(null, true)
regardless of mimetype, extension, or content. Allows upload of executables, scripts, or
other dangerous file types.
```

### SHARED-010 [Medium] MongooseBaseRepository.count() no type safety or injection protection

```
FILE: server/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository.ts
LINE: 70-72
SEVERITY: Medium
CATEGORY: Type Safety
DESCRIPTION: count() passes filter directly to countDocuments without casting. No runtime
validation that filter properties are safe for MongoDB query injection. An attacker who can
influence the filter could inject MongoDB operators.
```

### SHARED-011 [Medium] insertMany() accepts singular instead of array

```
FILE: server/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository.ts
LINE: 79-81
SEVERITY: Medium
CATEGORY: API Contract
DESCRIPTION: insertMany() accepts data as Partial<TProps> (singular), but Mongoose's
insertMany() expects an array. The parameter type should be Partial<TProps>[].
```

### SHARED-012 [Medium] MongoBaseMapper.toDomain() leaks _id into domain layer

```
FILE: server/src/shared/infrastructure/persistence/mongo/MongoBaseMapper.ts
LINE: 13-14, 34
SEVERITY: Medium
CATEGORY: Data Integrity
DESCRIPTION: Only __v is deleted from props, but _id is NOT deleted. The domain entity
receives both an 'id' parameter and an '_id' property inside its props, leaking MongoDB
internals into the domain layer.
```

### SHARED-013 [Medium] BaseController.getParams() merges req.params, req.query, req.body unsafely

```
FILE: server/src/shared/infrastructure/http/BaseController.ts
LINE: 17-26
SEVERITY: Medium
CATEGORY: Security / Parameter Pollution
DESCRIPTION: getParams() merges req.params, req.query, and req.body into a flat object via
spread. req.params values CAN be overridden by req.query and req.body, which is a parameter
pollution vulnerability for route parameters like :id.
```

### SHARED-014 [Medium] Authentication middleware uses non-null assertion on SECRET_KEY

```
FILE: server/src/shared/infrastructure/http/middleware/authentication.ts
LINE: 37
SEVERITY: Medium
CATEGORY: Configuration
DESCRIPTION: process.env.SECRET_KEY is used with the non-null assertion operator (!). If
SECRET_KEY is not set, undefined is passed as the secret to jwt.verify(), producing a
confusing error. No startup validation that SECRET_KEY is defined.
```

### SHARED-015 [Medium] __MACOSX filter doesn't actually work

```
FILE: server/src/shared/infrastructure/services/FileExtractorService.ts
LINE: 31
SEVERITY: Medium
CATEGORY: Logic Error
DESCRIPTION: Checks if filename === '__MACOSX', but __MACOSX is a directory, and
getFilesRecursive() only returns files. Files inside __MACOSX/ have different basenames.
The filter should check if the full path contains '/__MACOSX/'.
```

### SHARED-016 [Medium] No error handling or cleanup on extraction failure

```
FILE: server/src/shared/infrastructure/services/FileExtractorService.ts
LINE: 10-62
SEVERITY: Medium
CATEGORY: Resource Leak
DESCRIPTION: extractFiles() has no error handling. If extraction fails partway, partially
extracted files remain on disk. No try/catch/finally for cleanup.
```

### SHARED-017 [Medium] getFilesRecursive() follows symlinks

```
FILE: server/src/shared/infrastructure/services/FileExtractorService.ts
LINE: 64-71
SEVERITY: Medium
CATEGORY: Security
DESCRIPTION: Does not check for symbolic links. A malicious zip could contain a symlink to
/etc or other sensitive directories. When scanned by getFilesRecursive(), the symlink is
followed, potentially exposing files outside the working directory.
```

### SHARED-018 [Medium] AccessControlService creates duplicate singleton instances

```
FILE: server/src/shared/infrastructure/services/AccessControlService.ts
LINE: 7-14, 41
SEVERITY: Medium
CATEGORY: Architecture
DESCRIPTION: Decorated with @injectable() for DI, but line 41 exports a separately
constructed instance. The authorization middleware imports the manual instance, not the
DI-managed one -- creating two separate instances.
```

### SHARED-019 [Medium] UserStrategy directly imports Mongoose models, violating clean architecture

```
FILE: server/src/shared/infrastructure/services/strategies/UserStrategy.ts
LINE: 3-4
SEVERITY: Medium
CATEGORY: Architecture / Coupling
DESCRIPTION: Directly imports TeamModel and TeamMemberModel from the team module's Mongoose
implementation, creating hard coupling from shared to a specific module's infrastructure.
```

### SHARED-020 [Medium] RedisEventBus does not handle connection failures

```
FILE: server/src/shared/infrastructure/events/RedisEventBus.ts
LINE: 17-22
SEVERITY: Medium
CATEGORY: Reliability
DESCRIPTION: Constructor creates Redis clients with no error event handlers. Since it's
@singleton(), DI fails permanently if Redis connection fails. No reconnection or health check.
```

### SHARED-021 [Medium] RedisEventBus subscribe() duplicates channel subscriptions

```
FILE: server/src/shared/infrastructure/events/RedisEventBus.ts
LINE: 30-48
SEVERITY: Medium
CATEGORY: Resource Leak
DESCRIPTION: Every call to subscribe() calls subscriber.subscribe(eventName) even if already
subscribed. No unsubscribe mechanism -- handlers accumulate forever.
```

### SHARED-022 [Low] getClientIP() trusts X-Forwarded-For without proxy validation

```
FILE: server/src/shared/infrastructure/http/utilities/get-client-ip.ts
LINE: 4-8
SEVERITY: Low
CATEGORY: Security / IP Spoofing
DESCRIPTION: Directly trusts X-Forwarded-For header which can be trivially spoofed. If used
for security decisions, it can be bypassed.
```

### SHARED-023 [Low] updateById() does not run Mongoose validators

```
FILE: server/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository.ts
LINE: 58
SEVERITY: Low
CATEGORY: Data Integrity
DESCRIPTION: findByIdAndUpdate() called without { runValidators: true }. Schema validators
silently bypassed during updates, potentially allowing invalid data.
```

### SHARED-024 [Low] updateMany() does not run Mongoose validators

```
FILE: server/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository.ts
LINE: 74-76
SEVERITY: Low
CATEGORY: Data Integrity
DESCRIPTION: model.updateMany() called without { runValidators: true }. Same issue as
SHARED-023 but for bulk updates.
```

### SHARED-025 [Low] BaseController uses console.error instead of logger

```
FILE: server/src/shared/infrastructure/http/BaseController.ts
LINE: 47
SEVERITY: Low
CATEGORY: Observability
DESCRIPTION: Uses console.error(error) while rest of codebase uses pino-based logger. Output
not formatted consistently with other log entries.
```

### SHARED-026 [Low] Rasterizer uses console.warn/console.error

```
FILE: server/src/shared/infrastructure/utils/rasterizer.ts
LINE: 34, 53
SEVERITY: Low
CATEGORY: Observability
DESCRIPTION: Uses console.warn() and console.error() instead of the shared pino logger.
```

### SHARED-027 [Low] slugify() strips all non-ASCII characters

```
FILE: server/src/shared/infrastructure/utilities/slugify.ts
LINE: 1-5
SEVERITY: Low
CATEGORY: Internationalization
DESCRIPTION: Regex /[^a-z0-9]+/g strips all non-ASCII characters. slugify("Tokyo") works,
but slugify() of CJK or accented text returns empty string.
```

---

# Module: Auth

**Path:** `server/src/modules/auth/`

---

### AUTH-001 [Critical] Missing await on findById -- null check always passes

```
FILE: server/src/modules/auth/application/use-cases/UpdateAccountUseCase.ts
LINE: 19
SEVERITY: Critical
CATEGORY: Missing Await
DESCRIPTION: this.userRepository.findById(input.userId) is called without await. The return
value is a Promise, which is always truthy. The null check on line 20 can never be false, so
a non-existent user silently passes validation. The subsequent updateById will attempt to
update a record that does not exist.
```

### AUTH-002 [High] Env var typo -- GOGLE_CLIENT_ID (missing O)

```
FILE: server/src/modules/auth/infrastructure/http/passport/config.ts
LINE: 14
SEVERITY: High
CATEGORY: Environment Variable Typo
DESCRIPTION: Guard condition reads process.env.GOGLE_CLIENT_ID (missing second "O"). Because
this env var never matches what operators set, Google OAuth strategy is never registered with
Passport. Google login is silently broken in all environments.
```

### AUTH-003 [High] Env var typo -- MICROSOFT_CALLBACL_URL

```
FILE: server/src/modules/auth/infrastructure/http/passport/strategies/MicrosoftStrategy.ts
LINE: 28
SEVERITY: High
CATEGORY: Environment Variable Typo
DESCRIPTION: process.env.MICROSOFT_CALLBACL_URL contains typo "CALLBACL" instead of
"CALLBACK". The non-null assertion means TypeScript won't warn. At runtime the value is
undefined, coerced to "undefined" and passed as callbackURL. Every Microsoft OAuth login
attempt fails.
```

### AUTH-004 [Medium] @ts-ignore suppresses type mismatch, leaks password

```
FILE: server/src/modules/auth/application/use-cases/UpdatePasswordUseCase.ts
LINE: 68-72
SEVERITY: Medium
CATEGORY: Type Mismatch / Security
DESCRIPTION: A @ts-ignore suppresses a type error on the Result.ok return. The
UpdatePasswordOutputDTO expects { token, user: UserProps }, but the raw domain entity
(with password field) is returned. The user's hashed password is leaked in the response.
```

### AUTH-005 [Medium] Missing null check on req.user

```
FILE: server/src/modules/auth/infrastructure/http/controllers/GetMyAccountController.ts
LINE: 9
SEVERITY: Medium
CATEGORY: Runtime Error
DESCRIPTION: Accesses req.user.props without null-checking req.user. The type declares
user as optional. If this controller is mounted without protect middleware, accessing .props
on undefined throws TypeError.
```

### AUTH-006 [Low] Typo in error message "afer"

```
FILE: server/src/modules/auth/application/use-cases/UpdateAccountUseCase.ts
LINE: 35
SEVERITY: Low
CATEGORY: Typo
DESCRIPTION: Error message reads 'User not found afer update' -- should be 'after'.
```

### AUTH-007 [Low] Misleading property name useRepository

```
FILE: server/src/modules/auth/application/use-cases/UpdatePasswordUseCase.ts
LINE: 18
SEVERITY: Low
CATEGORY: Naming
DESCRIPTION: Constructor parameter is named useRepository instead of userRepository. While
internally consistent, it deviates from every other use case's naming convention.
```

### AUTH-008 [Low] Comment typo "emaill"

```
FILE: server/src/modules/auth/application/use-cases/OAuthLoginUseCase.ts
LINE: 32
SEVERITY: Low
CATEGORY: Typo
DESCRIPTION: Comment reads 'Check if user exists with this emaill' -- extra "l".
```

---

# Module: Team

**Path:** `server/src/modules/team/`

---

### TEAM-001 [High] Schema-repository mismatch -- $push to nonexistent `members` field

```
FILE: server/src/modules/team/infrastructure/persistence/mongo/repositories/TeamRepository.ts
LINE: 29-31
SEVERITY: High
CATEGORY: Schema Mismatch
DESCRIPTION: addMemberToTeam pushes memberId into a members array via $push: { members }.
However, the TeamModel schema only defines name, description, and owner. There is no members
field. Mongoose strict mode causes the $push to silently do nothing. Members are never stored
on the team document.
```

### TEAM-002 [High] Schema-repository mismatch -- $push to nonexistent `roles` field

```
FILE: server/src/modules/team/infrastructure/persistence/mongo/repositories/TeamRepository.ts
LINE: 35-37
SEVERITY: High
CATEGORY: Schema Mismatch
DESCRIPTION: addRoleToTeam pushes roleId into a roles array via $push: { roles }. The
TeamModel schema has no roles field. Operation silently does nothing.
```

### TEAM-003 [High] Schema-repository mismatch -- $pull from nonexistent `admins` field

```
FILE: server/src/modules/team/infrastructure/persistence/mongo/repositories/TeamRepository.ts
LINE: 48-50
SEVERITY: High
CATEGORY: Schema Mismatch
DESCRIPTION: removeUserFromAllTeams does $pull: { admins: userId }. The TeamModel schema has
no admins field. Admin cleanup on user deletion never actually happens.
```

### TEAM-004 [High] Stale/phantom relation keys in TeamMapper

```
FILE: server/src/modules/team/infrastructure/persistence/mongo/mappers/TeamMapper.ts
LINE: 7-16
SEVERITY: High
CATEGORY: Mapper Defect
DESCRIPTION: Relation keys list 8 fields: owner, admins, members, invitations, containers,
trajectories, chats, plugins. Only 'owner' exists in the TeamModel schema. The mapper declares
relations for non-existent fields, creating a maintenance trap.
```

### TEAM-005 [High] Lost `this` context in TeamInvitationRepository.map()

```
FILE: server/src/modules/team/infrastructure/persistence/mongo/repositories/TeamInvitationRepository.ts
LINE: 24
SEVERITY: High
CATEGORY: Runtime Error
DESCRIPTION: docs.map(this.mapper.toDomain) passes toDomain as a bare function reference,
detaching it from this.mapper. Inside BaseMapper.toDomain(), the method accesses
this.relationKeys -- with no binding, this is undefined, causing TypeError. Crashes any
request that calls findPendingByTeam when there are pending invitations. Fix:
docs.map(doc => this.mapper.toDomain(doc)).
```

### TEAM-006 [High] acceptedAt set to now on PENDING invitation creation

```
FILE: server/src/modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase.ts
LINE: 107
SEVERITY: High
CATEGORY: Incorrect Data
DESCRIPTION: When creating an invitation with status: Pending, acceptedAt is set to new Date().
Records an acceptance timestamp at creation, even though the invitation has not been accepted.
UI showing "accepted at" will incorrectly show creation time.
```

### TEAM-007 [High] check-team-membership used as .param() callback with wrong signature

```
FILE: server/src/modules/team/infrastructure/http/middlewares/check-team-membership.ts
LINE: 8
SEVERITY: High
CATEGORY: API Misuse
DESCRIPTION: Registered as .param('teamId', checkTeamMembership) in mount-http-routes.ts
line 61, but has standard middleware signature (req, res, next). Express .param() callbacks
receive (req, res, next, value, name). While it still works because it reads req.params.teamId
directly, the .param() is applied to ALL module routers, causing unnecessary membership
checks on non-team routes (auth, session, notification, etc.).
```

### TEAM-008 [Medium] Duplicate event subscription for user.deleted

```
FILE: server/src/modules/team/infrastructure/events/subscribers.ts
LINE: 23-24
SEVERITY: Medium
CATEGORY: Duplicate Subscription
DESCRIPTION: user.deleted event is subscribed twice with the same handler on consecutive
lines 23 and 24. Every user deletion fires UserDeletedEventHandler.handle() twice, doubling
database load.
```

---

# Module: Core & Server Startup

**Path:** `server/src/core/` and `server/src/server.ts`

---

### CORE-001 [Critical] Server accepts connections before infrastructure ready

```
FILE: server/src/server.ts
LINE: 48-54
SEVERITY: Critical
CATEGORY: Startup Race Condition
DESCRIPTION: HTTP server begins accepting connections at line 48 (server.listen) BEFORE
MongoDB, Redis, and MinIO are initialized (lines 50-54 are inside the listen callback). Any
request arriving between socket opening and Promise.all completion hits routes that depend on
connections that don't exist yet.
```

### CORE-002 [Critical] No graceful shutdown -- process.exit(0) without cleanup

```
FILE: server/src/server.ts
LINE: 22-24, 74-75
SEVERITY: Critical
CATEGORY: No Graceful Shutdown
DESCRIPTION: The shutdown handler calls process.exit(0) immediately without: stopping HTTP
server, draining requests, closing MongoDB, quitting Redis, closing SocketGateway, or
stopping job queues. Causes data loss for in-progress operations and orphaned resources.
```

### CORE-003 [High] No global error-handling middleware

```
FILE: server/src/server.ts
LINE: 37
SEVERITY: High
CATEGORY: Error Handling
DESCRIPTION: No global error-handling middleware (4-argument function) is registered after
routes. Unhandled errors in route handlers produce Express's default HTML error page instead
of structured JSON. Async errors that aren't caught hang the request until timeout.
```

### CORE-004 [High] Redis enableReadyCheck disabled

```
FILE: server/src/core/config/redis.ts
LINE: 11
SEVERITY: High
CATEGORY: Configuration / Reliability
DESCRIPTION: enableReadyCheck set to false. Disables ioredis's mechanism to verify Redis is
fully ready. Combined with the timeout that resolves even when Redis is NOT ready, the
application proceeds to use a connection that may not be functional.
```

### CORE-005 [High] Redis timeout resolves promise even when not ready

```
FILE: server/src/core/config/redis.ts
LINE: 47-52
SEVERITY: High
CATEGORY: Silent Failure
DESCRIPTION: setTimeout resolves the initializeRedis() promise after 5 seconds even if Redis
never became ready. The caller treats this as successful initialization and proceeds to use
Redis for events, sockets, and queues. All subsequent operations will fail silently.
```

### CORE-006 [High] MinIO initializeMinio no retry, no try-catch

```
FILE: server/src/core/config/minio.ts
LINE: 71-76
SEVERITY: High
CATEGORY: Error Handling
DESCRIPTION: Iterates over system buckets sequentially. If any single bucket creation fails,
the exception propagates and prevents all subsequent buckets from being created. No retry.
```

### CORE-007 [High] MinIO late throw on missing credentials

```
FILE: server/src/core/config/minio.ts
LINE: 30-31
SEVERITY: High
CATEGORY: Startup Crash
DESCRIPTION: If MINIO_ACCESS_KEY or MINIO_SECRET_KEY are not set, createClient() throws a
generic Error. This happens lazily (only when getMinioClient() is called), deep in the
startup sequence, with no recovery path.
```

### CORE-008 [High] No rate limiting anywhere

```
FILE: server/src/core/config/express.ts
LINE: 56
SEVERITY: High
CATEGORY: Security / Denial of Service
DESCRIPTION: No rate limiting middleware configured anywhere in the application. Server is
vulnerable to abuse from unauthenticated endpoints (sign-in, sign-up, check-email) with no
protection against brute-force or volumetric attacks.
```

### CORE-009 [High] CORS origins may be undefined, silently blocking all cross-origin requests

```
FILE: server/src/core/config/express.ts
LINE: 15-19
SEVERITY: High
CATEGORY: CORS Misconfiguration
DESCRIPTION: If CLIENT_HOST (production) or CLIENT_DEV_HOST (development) env vars are not
set, the allowed origins array contains [undefined]. The includes() check fails for all
origins, blocking ALL cross-origin requests. The 'as string' cast hides undefined at compile
time.
```

### CORE-010 [High] router.param('teamId') with wrong callback signature

```
FILE: server/src/core/bootstrap/mount-http-routes.ts
LINE: 61
SEVERITY: High
CATEGORY: Express API Misuse
DESCRIPTION: Express .param(name, callback) expects callback with signature
(req, res, next, value, name). checkTeamMembership has (req, res, next). Express calls the
param callback with (req, res, next, paramValue), so next receives the teamId STRING, not
NextFunction. Calling next() calls the teamId string as a function -- but since
checkTeamMembership reads req.params.teamId directly (not from the callback arg), it may
still work in practice, though it's an API misuse.
```

### CORE-011 [High] Multiple Redis connections with no lifecycle management

```
FILE: server/src/core/bootstrap/register-deps.ts
LINE: 52-56
SEVERITY: High
CATEGORY: Resource Management
DESCRIPTION: Lines 52-53 call createRedisClient() at module import time, creating 2 Redis
connections before initializeRedis(). RedisEventBus creates 2 more. SocketGateway creates
2 more. Total 5+ Redis connections with no pooling or lifecycle management. None closed
during shutdown.
```

### CORE-012 [High] startQueues() no error handling or shutdown

```
FILE: server/src/core/bootstrap/start-queues.ts
LINE: 10-21
SEVERITY: High
CATEGORY: Reliability
DESCRIPTION: Starts 4 queue processors via Promise.all with no try-catch. If any queue
fails to start, Promise.all rejects. No corresponding stopQueues() function -- worker
threads keep running after SIGTERM.
```

### CORE-013 [Medium] Signal handlers registered too late

```
FILE: server/src/server.ts
LINE: 74-75
SEVERITY: Medium
CATEGORY: Signal Handling
DESCRIPTION: SIGTERM and SIGINT handlers registered inside server.listen callback. If a
signal is received before the callback completes, process terminates with default behavior
instead of application's shutdown handler.
```

### CORE-014 [Medium] SERVER_TIMEOUT not validated for NaN

```
FILE: server/src/server.ts
LINE: 20
SEVERITY: Medium
CATEGORY: Input Validation
DESCRIPTION: parseInt() on SERVER_TIMEOUT never validates for NaN. If set to non-numeric
string, NaN propagates to server.setTimeout(NaN), causing undefined timeout behavior.
```

### CORE-015 [Medium] startServer() called without .catch()

```
FILE: server/src/server.ts
LINE: 35-76
SEVERITY: Medium
CATEGORY: Unhandled Promise Rejection
DESCRIPTION: startServer() is async, called on line 79 with no .catch(). If any awaited
operation throws, the server continues in a partially initialized, non-functional state.
```

### CORE-016 [Medium] Redis error handler doesn't reject promise

```
FILE: server/src/core/config/redis.ts
LINE: 37-39
SEVERITY: Medium
CATEGORY: Error Handling
DESCRIPTION: Redis 'error' handler only logs. Never rejects the promise. If Redis emits an
error before 'ready', the promise hangs until the 5-second timeout resolves it "successfully".
```

### CORE-017 [Medium] MinIO bucketExists error converted to "doesn't exist"

```
FILE: server/src/core/config/minio.ts
LINE: 53
SEVERITY: Medium
CATEGORY: Error Suppression
DESCRIPTION: bucketExists() errors are caught and converted to false. If MinIO is unreachable
or has auth errors, the code treats it as "bucket doesn't exist" and attempts creation, which
also fails. The root cause (connectivity, auth) is masked.
```

### CORE-018 [Medium] CORS rejection returns HTML, not JSON

```
FILE: server/src/core/config/express.ts
LINE: 25
SEVERITY: Medium
CATEGORY: Error Handling
DESCRIPTION: When CORS rejects an origin, callback(new Error('Not allowed by CORS')) is not
caught by any error handler. Express returns an HTML error page instead of JSON, inconsistent
with the API's response format.
```

### CORE-019 [Medium] router.param applied to all modules unnecessarily

```
FILE: server/src/core/bootstrap/mount-http-routes.ts
LINE: 60-62
SEVERITY: Medium
CATEGORY: Performance / Correctness
DESCRIPTION: router.param('teamId', checkTeamMembership) is applied to EVERY module's router
including auth, session, notification, system -- modules whose routes never use :teamId.
Adds unnecessary middleware execution if those modules ever use a parameter named teamId.
```

### CORE-020 [Medium] DI registration as side effect at import time

```
FILE: server/src/core/bootstrap/register-deps.ts
LINE: 29-32, 34-50
SEVERITY: Medium
CATEGORY: Architecture
DESCRIPTION: All DI registration runs synchronously during module loading (import side
effect), before async initialization. Tight coupling to import order, fragile for testing.
```

### CORE-021 [Medium] startQueues partial failure not handled

```
FILE: server/src/core/bootstrap/start-queues.ts
LINE: 16-21
SEVERITY: Medium
CATEGORY: Reliability
DESCRIPTION: Promise.all rejects entirely if any one queue fails. Successfully started queues
have no reference kept for cleanup. Promise.allSettled would allow partial startup.
```

### CORE-022 [Medium] dotenv relative path breaks outside project root

```
FILE: server/src/core/config/env.ts
LINE: 2
SEVERITY: Medium
CATEGORY: Configuration
DESCRIPTION: dotenv.config() uses './.env' relative to process.cwd(). If the server is
started from a different directory, .env is not found and all env vars are undefined.
dotenv.config() does not throw on missing files.
```

### CORE-023 [Medium] registerAllSubscribers partial failure

```
FILE: server/src/core/events/registerAllSubscribers.ts
LINE: 20-32
SEVERITY: Medium
CATEGORY: Reliability
DESCRIPTION: Promise.all for all subscriber registrations. If any single registration fails,
the entire Promise.all rejects and remaining subscribers are lost. Should use
Promise.allSettled.
```

### CORE-024 [Low] Duplicate Redis connection factory functions

```
FILE: server/src/core/config/redis.ts
LINE: 18-20, 56-58
SEVERITY: Low
CATEGORY: Code Duplication
DESCRIPTION: createRedisConnection() and createRedisClient() are identical functions.
Duplication is confusing and error-prone.
```

### CORE-025 [Low] Validation code typo "SSHConenction"

```
FILE: server/src/core/constants/validation-codes.ts
LINE: 66
SEVERITY: Low
CATEGORY: Typo
DESCRIPTION: Value 'SSHConenction::Host::Required' -- "Conenction" instead of "Connection".
```

### CORE-026 [Low] Validation code misleading name vs value

```
FILE: server/src/core/constants/validation-codes.ts
LINE: 103
SEVERITY: Low
CATEGORY: Misleading Naming
DESCRIPTION: USER_FIRST_NAME_REQUIRED has value 'User::Username::Required' instead of
'User::FirstName::Required'.
```

### CORE-027 [Low] Error code inconsistent separator

```
FILE: server/src/core/constants/error-codes.ts
LINE: 104
SEVERITY: Low
CATEGORY: Formatting
DESCRIPTION: MESSAGE_FORBIDDEN has value 'Message:Forbidden' (single colon) while all other
codes use '::' (double colon).
```

### CORE-028 [Low] RuntimeError code and message are identical

```
FILE: server/src/core/exceptions/RuntimeError.ts
LINE: 8-9
SEVERITY: Low
CATEGORY: Error Quality
DESCRIPTION: Constructor passes code as message to super(code). error.message and error.code
are identical. No way to provide a human-readable description separate from machine-readable
code.
```

---

# Module: Container

**Path:** `server/src/modules/container/`

---

### CONTAINER-001 [Critical] PATCH route calls create controller instead of updateById

```
FILE: server/src/modules/container/infrastructure/http/routes/container-routes.ts
LINE: 22
SEVERITY: Critical
CATEGORY: Wrong Controller Binding
DESCRIPTION: The PATCH route for /:containerId calls controllers.create.handle instead of
controllers.updateById.handle. Every PATCH request intended to update a container will
instead attempt to CREATE a new container.
```

### CONTAINER-002 [Critical] TeamDeletedEventHandler only deletes DB records, not Docker containers

```
FILE: server/src/modules/container/application/events/TeamDeletedEventHandler.ts
LINE: 22
SEVERITY: Critical
CATEGORY: Resource Leak
DESCRIPTION: deleteByTeamId only deletes MongoDB records. Does NOT stop or remove actual
running Docker containers, networks, or volumes. After team deletion, Docker containers
continue running as orphans consuming host resources with no way to manage them.
```

### CONTAINER-003 [High] DELETE route uses canRead instead of canDelete

```
FILE: server/src/modules/container/infrastructure/http/routes/container-routes.ts
LINE: 3, 23
SEVERITY: High
CATEGORY: Incorrect Authorization
DESCRIPTION: DELETE route uses canRead(Resource.CONTAINER) instead of
canDelete(Resource.CONTAINER). Any user with READ permission can delete containers. canDelete
is not even imported in the file.
```

### CONTAINER-004 [High] Path traversal in getFiles -- unsanitized path to ls command

```
FILE: server/src/modules/container/infrastructure/services/DockerContainerService.ts
LINE: 84-86
SEVERITY: High
CATEGORY: Security / Path Traversal
DESCRIPTION: getFiles() accepts user-supplied path and passes it directly to
exec(containerId, ['ls', '-la', '--full-time', path]) with no sanitization. Attacker can
list arbitrary directories inside the container.
```

### CONTAINER-005 [High] Path traversal in readFile -- unsanitized path to cat command

```
FILE: server/src/modules/container/infrastructure/services/DockerContainerService.ts
LINE: 110-112
SEVERITY: High
CATEGORY: Security / Path Traversal
DESCRIPTION: readFile() accepts user-supplied path and passes to exec(containerId, ['cat', path])
with no sanitization. Attacker can read any file inside the container.
```

### CONTAINER-006 [Medium] Blocking execSync in CreateContainerUseCase

```
FILE: server/src/modules/container/application/use-cases/CreateContainerUseCase.ts
LINE: 54
SEVERITY: Medium
CATEGORY: Performance / Blocking
DESCRIPTION: execSync("getent group docker | cut -d: -f3") blocks the event loop. In a
containerized environment where getent is unavailable, this throws (caught but silent).
```

### CONTAINER-007 [Medium] Use case directly imports Mongoose models (bypasses repository)

```
FILE: server/src/modules/container/application/use-cases/CreateContainerUseCase.ts
LINE: 103-104
SEVERITY: Medium
CATEGORY: Architecture Violation
DESCRIPTION: Dynamic await import() for DockerNetworkModel and DockerVolumeModel, calling
.create() directly on Mongoose models. Bypasses repository abstraction. Same pattern in
UpdateContainerUseCase (line 99) and DeleteContainerUseCase (line 33).
```

### CONTAINER-008 [Medium] DTO shape mismatch in ListContainersUseCase

```
FILE: server/src/modules/container/application/use-cases/ListContainersUseCase.ts
LINE: 20
SEVERITY: Medium
CATEGORY: Data Mismatch
DESCRIPTION: Returns Result.ok(result) where result is PaginatedResult (shape:
{ data, total, page, ... }) but ListContainersOutputDTO expects { containers: any[] }.
The result object has no 'containers' property -- the array is under 'data'.
```

### CONTAINER-009 [Medium] UpdateContainerUseCase directly imports Mongoose model

```
FILE: server/src/modules/container/application/use-cases/UpdateContainerUseCase.ts
LINE: 99-100
SEVERITY: Medium
CATEGORY: Architecture Violation
DESCRIPTION: Same as CONTAINER-007. Dynamic import of DockerNetwork Mongoose model and
direct .findById() call, bypassing repository.
```

### CONTAINER-010 [Medium] DeleteContainerUseCase directly imports Mongoose model

```
FILE: server/src/modules/container/application/use-cases/DeleteContainerUseCase.ts
LINE: 33-34
SEVERITY: Medium
CATEGORY: Architecture Violation
DESCRIPTION: Same as CONTAINER-007. Dynamic import of DockerNetwork Mongoose model,
bypassing repository.
```

### CONTAINER-011 [Medium] Docker volume never removed on container deletion

```
FILE: server/src/modules/container/application/use-cases/DeleteContainerUseCase.ts
LINE: 41-49
SEVERITY: Medium
CATEGORY: Resource Leak
DESCRIPTION: Container deletion removes the Docker container and network, but never the
Docker volume. Named volumes persist as orphans on the Docker host. DockerVolume MongoDB
document also never cleaned up.
```

### CONTAINER-012 [Low] Redundant stopContainer before force-remove

```
FILE: server/src/modules/container/application/use-cases/DeleteContainerUseCase.ts
LINE: 25-26
SEVERITY: Low
CATEGORY: Redundant Operation
DESCRIPTION: Calls stopContainer then removeContainer, but removeContainer uses force: true
which kills and removes in one step. The stop is redundant and introduces a race window.
```

### CONTAINER-013 [Low] Unused 'ContainerModel' DI token registration

```
FILE: server/src/modules/container/infrastructure/di/container.ts
LINE: 19
SEVERITY: Low
CATEGORY: Dead Code
DESCRIPTION: Registers 'ContainerModel' token but no class injects it. ContainerRepository
imports ContainerModel directly.
```

---

# Module: Trajectory

**Path:** `server/src/modules/trajectory/`

---

### TRAJECTORY-001 [High] Unimplemented downloadArchive() -- live route always crashes

```
FILE: server/src/modules/trajectory/infrastructure/services/VFSService.ts
LINE: 46-48
SEVERITY: High
CATEGORY: Unimplemented Method
DESCRIPTION: downloadArchive() unconditionally throws Error("Method not implemented."). A
route is registered for it (GET /:trajectoryId/archive). Any request to this endpoint returns
a 500 Internal Server Error. This is a live route that always crashes.
```

### TRAJECTORY-002 [High] TeamDeletedEventHandler -- deleteMany orphans cloud storage

```
FILE: server/src/modules/trajectory/application/events/TeamDeletedEventHandler.ts
LINE: 17
SEVERITY: High
CATEGORY: Resource Leak
DESCRIPTION: deleteMany({ team: teamId }) only deletes MongoDB records. The overridden
deleteById (which publishes TrajectoryDeletedEvent for storage cleanup) is bypassed. All
dump files in cloud storage, cached files, simulation cells, GLB models, and analysis data
remain as orphans.
```

### TRAJECTORY-003 [Medium] Missing await on fs.utimes

```
FILE: server/src/modules/trajectory/infrastructure/services/TrajectoryDumpStorageService.ts
LINE: 127
SEVERITY: Medium
CATEGORY: Missing Await
DESCRIPTION: fs.utimes(cachePath, new Date(), new Date()) called without await. Since fs is
from node:fs/promises, returns a Promise that's never awaited. If the call fails, the
rejection becomes unhandled and can crash the process. The similar call in getDumpStream()
(line 222) correctly uses .catch(() => {}), confirming this was an oversight.
```

### TRAJECTORY-004 [Medium] Invalid field 'analysis: []' in create call

```
FILE: server/src/modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUseCase.ts
LINE: 41
SEVERITY: Medium
CATEGORY: Schema Mismatch
DESCRIPTION: Passes analysis: [] to trajectoryRepo.create(). TrajectoryProps interface does
NOT include an analysis field, and TrajectoryModel schema does NOT define it. Mongoose
silently strips the field. Misleading dead code.
```

### TRAJECTORY-005 [Medium] Inconsistent module export pattern (vfs-routes)

```
FILE: server/src/modules/trajectory/infrastructure/http/routes/vfs-routes.ts
LINE: 33
SEVERITY: Medium
CATEGORY: Inconsistency
DESCRIPTION: Exports router directly as default export instead of an HttpModule object with
{ basePath, router }. A wrapper file TrajectoryVfsHttpModule.ts compensates, but this is the
only route file breaking the convention, making it easy to mount incorrectly.
```

### TRAJECTORY-006 [Low] Potential division by zero in progress callback

```
FILE: server/src/modules/trajectory/infrastructure/services/TrajectoryDumpStorageService.ts
LINE: 79-92
SEVERITY: Low
CATEGORY: Division by Zero
DESCRIPTION: When totalSize is 0, line 92 computes processedBytes / totalSize yielding
Infinity or NaN. Math.min(1, NaN) returns NaN. Progress callback would receive NaN.
```

### TRAJECTORY-007 [Low] DI token style inconsistency in VFSService

```
FILE: server/src/modules/trajectory/infrastructure/services/VFSService.ts
LINE: 7
SEVERITY: Low
CATEGORY: DI Token Inconsistency
DESCRIPTION: Injects using string token 'IStorageService' while rest of trajectory module
uses Symbol tokens via SHARED_TOKENS. The string registration exists so it works, but if
the string registration is removed this service fails.
```

### TRAJECTORY-008 [Low] Debug console.log in ParticleFilterService

```
FILE: server/src/modules/trajectory/infrastructure/services/ParticleFilterService.ts
LINE: 188
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: console.log('UPLOAD TO STORAGE SERVER:', objectName) -- debug log leaking
internal storage paths.
```

### TRAJECTORY-009 [Low] Debug console.log in ParticleFilterService (2)

```
FILE: server/src/modules/trajectory/infrastructure/services/ParticleFilterService.ts
LINE: 214
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: console.log('OBJECT NAME:', objectName) -- same issue.
```

### TRAJECTORY-010 [Low] Extensive console.log/console.error in SessionCompletedEventHandler

```
FILE: server/src/modules/trajectory/application/events/SessionCompletedEventHandler.ts
LINE: 33, 37, 45, 59, 74, 78, 93, 97, 110
SEVERITY: Low
CATEGORY: Code Hygiene
DESCRIPTION: 9 occurrences of console.log/console.error instead of structured logger.
Bypasses log levels and transport configuration.
```

---

# Module: Chat

**Path:** `server/src/modules/chat/`

---

### CHAT-001 [Critical] markMessageAsRead parameter mismatch -- chatId treated as messageId

```
FILE: server/src/modules/chat/infrastructure/persistence/mongo/repositories/ChatMessageRepository.ts
LINE: 17-18
SEVERITY: Critical
CATEGORY: Parameter Mismatch
DESCRIPTION: markMessageAsRead(messageId, userId) names its first parameter messageId and
calls findByIdAndUpdate(messageId). But the interface IChatMessageRepository defines the
first parameter as chatId, and the caller MarkMessagesAsReadUseCase passes a chatId. Result:
a chatId is used as a messageId in findByIdAndUpdate. Either updates the wrong document or
silently fails. Messages are never actually marked as read.
```

### CHAT-002 [Medium] Inconsistent mapper export pattern

```
FILE: server/src/modules/chat/infrastructure/persistence/mongo/mappers/ChatMessageMapper.ts
LINE: 16
SEVERITY: Medium
CATEGORY: Maintenance Hazard
DESCRIPTION: ChatMessageMapper exports the class (export default ChatMessageMapper) while
ChatMapper exports a pre-instantiated singleton. ChatMessageRepository imports it as lowercase
and calls new chatMessageMapper(). If someone "fixes" the export to match the convention,
ChatMessageRepository would break by calling new on an instance.
```

### CHAT-003 [Medium] Comma operator instead of semicolon in route registration

```
FILE: server/src/modules/chat/infrastructure/http/routes/chat-routes.ts
LINE: 15
SEVERITY: Medium
CATEGORY: Syntax
DESCRIPTION: Line ends with a trailing comma instead of semicolon, creating a comma
expression. Functionally benign in this context but indicates a typo that could mask issues
during refactoring.
```

### CHAT-004 [Low] Duplicate @injectable() decorator

```
FILE: server/src/modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase.ts
LINE: 9-10
SEVERITY: Low
CATEGORY: Code Quality
DESCRIPTION: @injectable() decorator applied twice. Copy-paste error. May cause unexpected
DI behavior in certain container configurations.
```

---

# Module: SSH

**Path:** `server/src/modules/ssh/`

---

### SSH-001 [High] setInterval never cleared -- resource leak

```
FILE: server/src/modules/ssh/infrastructure/services/SSHConnectionService.ts
LINE: 48
SEVERITY: High
CATEGORY: Resource Leak
DESCRIPTION: Constructor starts setInterval for cleanupIdleConnections every 60s, but the
interval handle is never stored or cleared. No shutdown/destroy method exists. Each
instantiation leaks an additional timer. No way to perform graceful cleanup.
```

---

# Module: API Tracker

**Path:** `server/src/modules/api-tracker/`

---

### APITRACKER-001 [Critical] Event name mismatch -- handler never fires

```
FILE: server/src/modules/api-tracker/infrastructure/events/subscribers.ts
LINE: 14
SEVERITY: Critical
CATEGORY: Event Name Mismatch
DESCRIPTION: Subscribes to 'user:deleted' (colon separator), but UserDeletedEvent defines
name as 'user.deleted' (dot separator). Every other module uses 'user.deleted'. The
api-tracker UserDeletedEventHandler will NEVER fire. API tracker records are never cleaned
up on user deletion, accumulating as orphaned data.
```

### APITRACKER-002 [Critical] Lost `this` context -- route handler crashes on every request

```
FILE: server/src/modules/api-tracker/infrastructure/http/routes/api-tracker-routes.ts
LINE: 17
SEVERITY: Critical
CATEGORY: Runtime Error
DESCRIPTION: Route registered as router.get('/', listApiTrackerController.handle).
ListApiTrackerController.handle is a regular method (not arrow function, not bound, does not
extend BaseController). When Express invokes it, this is undefined. Accessing
this.useCase.execute() throws TypeError. Every GET to /api/api-tracker/ crashes.
```

### APITRACKER-003 [High] Event handler accesses wrong property on event object

```
FILE: server/src/modules/api-tracker/application/events/UserDeletedEventHandler.ts
LINE: 6-11, 20, 22
SEVERITY: High
CATEGORY: Data Shape Mismatch
DESCRIPTION: Handler defines its own inline UserDeletedEvent with userId as top-level
property. The real UserDeletedEvent wraps data in event.payload.userId. Handler accesses
event.userId (lines 20, 22) which would be undefined. Even if the event name (APITRACKER-001)
were fixed, this handler would pass undefined to deleteByUserId().
```

### APITRACKER-004 [Medium] Fragile string DI tokens instead of Symbols

```
FILE: server/src/modules/api-tracker/infrastructure/persistence/mongo/repositories/ApiTrackerRepository.ts
LINE: 10
SEVERITY: Medium
CATEGORY: DI Token Fragility
DESCRIPTION: Uses @inject('ApiTrackerModel') with raw string token. Every other module uses
Symbol.for() tokens via *_TOKENS objects. A typo in any of these strings causes silent DI
resolution failure at runtime with no compile-time error.
```

---

# Module: Simulation Cell

**Path:** `server/src/modules/simulation-cell/`

---

### SIMCELL-001 [High] Authorization bypass -- FindCellByIdUseCase ignores teamId

```
FILE: server/src/modules/simulation-cell/application/use-cases/FindCellByIdUseCase.ts
LINE: 17
SEVERITY: High
CATEGORY: Authorization Bypass
DESCRIPTION: The use case calls repository.findById(input.id) using ONLY the cell ID. Never
checks that the returned cell's team matches the teamId from the request URL. A user who is
a member of Team A can pass Team A's teamId (passing middleware checks) while specifying a
cell ID from Team B. The cell from Team B is returned successfully. FindCellByIdInputDTO
defines only { id: string } with no teamId field.
```

### SIMCELL-002 [Medium] DI container resolution at module-load time

```
FILE: server/src/modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes.ts
LINE: 11-12
SEVERITY: Medium
CATEGORY: DI / Initialization Fragility
DESCRIPTION: Controllers resolved from DI container at import time, not request time. Creates
tight coupling to import ordering. Any refactoring that changes import order causes runtime
"could not resolve token" errors.
```

### SIMCELL-003 [Medium] Mapper leaks __v into domain entity

```
FILE: server/src/modules/simulation-cell/infrastructure/persistence/mongo/mappers/SimulationCellMapper.ts
LINE: 7-8
SEVERITY: Medium
CATEGORY: Data Leakage
DESCRIPTION: toDomain destructures { _id, ...props } from toObject() but unlike BaseMapper,
does not delete __v from props. Every SimulationCell entity and API response contains
extraneous __v: 0.
```

### SIMCELL-004 [Medium] Event handlers lack error handling

```
FILE: server/src/modules/simulation-cell/application/events/TeamDeletedEventHandler.ts
LINE: 14-17
SEVERITY: Medium
CATEGORY: Error Handling
DESCRIPTION: Both TeamDeletedEventHandler and TrajectoryDeletedEventHandler call
deleteMany() without try-catch. If deleteMany fails, the error is completely silent: no log,
no retry. Orphaned simulation cells remain in database.
```

### SIMCELL-005 [Low] GetSimulationCellController is a 404 stub

```
FILE: server/src/modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellController.ts
LINE: 6-18
SEVERITY: Low
CATEGORY: Dead Code
DESCRIPTION: Controller always returns HTTP 404 with hard-coded error. Has TODO comment.
Never registered in DI or routes. Dead code.
```

### SIMCELL-006 [Low] ListSimulationCellsController is unused duplicate

```
FILE: server/src/modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsController.ts
LINE: 1-13
SEVERITY: Low
CATEGORY: Dead Code
DESCRIPTION: Functionally identical to FindCellsByTeamIdController. Never registered in DI
or routes. Earlier duplicate that was superseded.
```

### SIMCELL-007 [Low] toPersistence spreads timestamps, may override Mongoose auto-management

```
FILE: server/src/modules/simulation-cell/infrastructure/persistence/mongo/mappers/SimulationCellMapper.ts
LINE: 11-15
SEVERITY: Low
CATEGORY: Mapper Defect
DESCRIPTION: toPersistence spreads all props including createdAt/updatedAt. Since schema uses
timestamps: true, passing explicit values could override Mongoose's automatic timestamp
management.
```

---

# End of Audit

**Total bugs found: 144**

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 17 | Fix immediately -- runtime crashes, security vulnerabilities, data corruption |
| High | 41 | Fix before next release -- broken features, auth bypasses, resource leaks |
| Medium | 51 | Fix in current sprint -- data integrity, architecture violations, silent failures |
| Low | 35 | Fix opportunistically -- typos, dead code, code hygiene |
