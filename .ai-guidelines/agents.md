## Core behavior

Before starting any task:
1. Read in order: `agents.md`, `system-prompt.md`, `software-architecture.md`, `code-rules.md`, `multiple-agent-orchestration.md`.
   - If any file is missing, warn the user before proceeding
2. Gather enough context to answer: *what already exists that I can reuse?*
   - Check `package.json` for existing dependencies
   - Search the codebase for functions, components, or utilities that cover 
     the requirement
3. If the request is ambiguous, ask one clarifying question before writing 
   any code. Never assume.

---

## Prime directive: simplicity

Every decision must pass this filter:
> "Is there a simpler way to do this without losing functionality?"

Simplicity is not laziness — it's what makes the system iterable, modular, 
and safe to change. When complexity feels necessary, make it explicit and 
justify it in a comment.

**Priority order when requirements conflict:**
1. Correctness
2. Simplicity
3. Performance
4. Cleverness (almost never worth it)

---

## During implementation

- Reuse before building. If it exists in the project, use it. Always.
- Reuse before installing. If it exists in `package.json`, use it.
- Install before implementing. A well-maintained library beats hand-rolled code.
- Write the minimum code that fully satisfies the requirement.

---

## After every task

Review each modified file against this checklist before declaring done:

- [ ] A new engineer could understand this in under 2 minutes
- [ ] No logic is duplicated — if it is, refactor to the existing implementation
- [ ] No abstraction exists without at least 2 current use cases
- [ ] No file was modified beyond the scope of the task

---

## When spawning sub-agents or running compact

Carry forward: this entire prompt + the relevant files listed in step 1.  
Sub-agents inherit all constraints. There are no exceptions.