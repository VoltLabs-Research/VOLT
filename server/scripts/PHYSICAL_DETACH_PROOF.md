# PHYSICAL_DETACH_PROOF — manual procedure

This is the **hard proof** that a VOLT-server module is *physically* detachable:
not merely "no forbidden imports on paper" but "the source tree compiles and the
server boots with the module's directory **deleted from disk**". The automated
guards (`npm run depcruise`, `npm run smoke:modules`) prove the static-import
rule and the toggle/closure logic; this procedure proves the end state they
imply.

> Run this in a **throwaway** working copy. It deletes module source. Use a git
> stash/branch or a separate checkout so nothing real is at risk.

## What "detachable" means here

A module `src/modules/<m>/` is detachable when, with `<m>` removed from disk and
excluded from `VOLT_MODULES`:

1. `npx tsc -p tsconfig.json --noEmit` exits **0** (nothing else statically
   imports `@modules/<m>/...` — kernel `auth/session/socket/team` and
   `@shared/**` are the only cross-cutting import targets allowed), and
2. the server **boots** (module resolution validates and route mounting / DI
   wiring do not hard-require the missing module).

If both hold, the module is provably severable: removing it is a no-op to the
rest of the system.

## Pick a safe leaf first

Test the freely-detachable **leaf** modules before anything deeper — they sit at
the bottom of the `requires` graph (`requires: ['team']` at most, `team` being
kernel), so nothing should depend on them. Safe-to-test-first leaves:

- `latex`
- `whiteboards`
- `chat`
- `daily-activity`

(`scripting` and `dashboard` are also leaves but `scripting` requires
`container` and `dashboard` has many `optional` edges — exercise the four above
first.) Do **not** start with `compute`/`capability`/`kernel` modules; kernel
(`auth`, `session`, `socket`, `team`) is by definition non-detachable.

## Procedure

Run from the server root: `app/VOLT/server`. Replace `<leaf>` with one of the
modules above (example uses `latex`).

```bash
LEAF=latex     # one of: latex whiteboards chat daily-activity

# 0) Confirm a clean baseline FIRST — the proof is only meaningful if tsc is
#    green before you remove anything. (Concurrent module migrations may make
#    src dirty; if so, stash/branch to a known-green commit before proceeding.)
npx tsc -p tsconfig.json --noEmit && echo "baseline tsc GREEN"

# 1) Isolate the experiment so it is trivially reversible.
git stash push -u -m "detach-proof-$LEAF"   # or: git switch -c detach-proof/$LEAF
#   (If you stashed, re-apply nothing yet — work on the clean tree.)

# 2) Physically remove the leaf's source tree.
rm -rf "src/modules/$LEAF"

# 3) Compile the WHOLE server with the leaf gone. Any error here names the file
#    that still statically imports @modules/$LEAF/... — that is a real coupling
#    bug to fix (route a port through @shared/contracts), NOT a reason to abort.
npx tsc -p tsconfig.json --noEmit 2>&1 | tee /tmp/detach-$LEAF-tsc.log
#   Expect: exit 0, empty log. Grep sanity check:
grep -E "modules/$LEAF" /tmp/detach-$LEAF-tsc.log || echo "no dangling refs to $LEAF"

# 4) Boot with the leaf excluded from the enabled set. Build the comma list of
#    every OTHER module dir (kernel forced on regardless) so VOLT_MODULES is a
#    valid closed set, then start. Watch for a clean listen, not a crash.
KEEP=$(ls src/modules | grep -vx "$LEAF" | paste -sd, -)
VOLT_MODULES="$KEEP" npm run start
#   Expect in logs: `@modules: enabled=...` WITHOUT $LEAF, then the server
#   reaches its normal "listening on :8000" state. Ctrl-C once confirmed.
#   (Boot needs Mongo/Redis/MinIO per .env.example — use the desktop compose
#    stack or local services. A connection error to those is an ENV problem,
#    not a detachability failure; the detachability signal is whether module
#    resolution + route/DI wiring tolerate the missing module.)

# 5) PROVE IT'S A PROOF: also confirm the negative — that the module is NOT
#    silently still loaded. The enabled-set log line must omit $LEAF and no
#    route under the leaf's base path should mount.

# 6) Restore. Nothing above is permanent.
git checkout -- . ; git stash pop    # or: git switch - && git branch -D detach-proof/$LEAF
```

## Interpreting the result

| Step 3 (tsc) | Step 4 (boot) | Verdict |
|---|---|---|
| exit 0, no refs | clean listen w/o `$LEAF` | **Detachable.** Proven severable. |
| errors naming `@modules/$LEAF` | — | Not yet detachable: a sibling still imports it. Fix the importer (move the shared surface to `@shared/contracts`), then re-run. |
| exit 0 | boot crashes referencing `$LEAF` | Static graph is clean but a runtime path hard-requires it (DI token, route mount, event subscriber). Make that path tolerate `isModuleEnabled('$LEAF') === false`. |

## Relationship to the automated guards

- `npm run depcruise` — static, fast, runs in CI: flags **every**
  `src/modules/<a>/** -> src/modules/<b>/**` edge where `b` is non-kernel and
  `b != a`. A green depcruise predicts step 3 will pass for *all* modules at
  once; this manual proof confirms it for one module concretely (including the
  runtime boot that depcruise cannot see).
- `npm run smoke:modules` — proves `resolveEnabledModules` force-enables the
  kernel and transitively closes `requires`, i.e. that the `VOLT_MODULES` value
  you pass in step 4 resolves to the set you expect.

Run both before the manual proof; they catch the cheap failures so the
disk-deletion experiment only has to confirm the real end state.
