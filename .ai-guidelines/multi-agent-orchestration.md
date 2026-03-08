## Multi-Agent Task Orchestration

When a user request involves modifying **3 or more independent files or modules**, 
propose breaking the work into sub-agent tasks before starting.

---

### Trigger condition

Propose multi-agent mode when the task meets at least one of these:
- Touches 3+ independent modules or directories
- Requires 5+ distinct file changes
- Has clearly separable concerns (e.g., backend + frontend + tests)

If the condition is met, ask: *"This task involves several independent changes. 
Do you want me to split it into sub-agent tasks for parallel execution?"*

---

### Directory structure

If the user agrees, create the following structure:
```
{appropriate-name}-tasks/
    context.md
    sequential-tasks/
        01-{task-name}.md
        02-{task-name}.md
        ...
    concurrent-tasks/
        agent-1-{scope}.md
        agent-2-{scope}.md
        ...
    integration-task/
        verify-and-merge.md
```

---

### context.md (always required)

This file is the shared contract between all agents. It must include:

- **Goal**: one-paragraph summary of the overall task
- **Shared interfaces / types**: any signatures, types, or APIs that multiple 
  agents will produce or consume
- **Architectural decisions**: conventions to follow (naming, patterns, etc.)
- **Dependency map**: which agent outputs another agent depends on

---

### sequential-tasks/

Use when tasks have dependencies on each other (output of step N is input of step N+1).

- Files are named with a zero-padded index: `01-`, `02-`, etc. so execution 
  order is unambiguous
- Each file must complete before the next begins

---

### concurrent-tasks/

Use when tasks are fully independent. 

**Hard rule**: if two agents would touch the same file, they cannot run 
concurrently — move one of them to `sequential-tasks/`.

Name files by scope, not by number: `agent-1-auth-module.md`, 
`agent-2-container-api.md`. The scope name makes it immediately clear 
what each agent owns.

---

### integration-task/verify-and-merge.md (always required when using concurrent-tasks)

Always create this as the final step after all concurrent agents finish. It must:

1. Verify the project builds / compiles with no errors
2. Check that shared interfaces match between agents
3. Run tests if applicable
4. Resolve any naming or import conflicts

---

### Task file structure

Every task file (sequential or concurrent) must follow this template:
```markdown
# Task: {name}

## Scope
Files and directories this agent is exclusively responsible for.

## Context
Relevant excerpt from context.md or prior task output this agent depends on.

## Steps
Concrete, ordered list of changes to make.

## Definition of done
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] No TypeScript / lint errors in owned files
```

---

### Decision flowchart
```
Request received
    │
    ▼
≥3 independent modules? ──No──▶ Work normally
    │
   Yes
    │
    ▼
Ask user for confirmation
    │
    ▼
Create context.md first
    │
    ▼
Tasks have dependencies? ──Yes──▶ sequential-tasks/
    │
    No
    │
    ▼
Any shared files? ──Yes──▶ Split or serialize those files
    │
    No
    │
    ▼
concurrent-tasks/ + integration-task/
```