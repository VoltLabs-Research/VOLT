# Code Rules

## Imports

### 1. Use `import type` at the top level, not inline
```ts
// BAD
import { type InfiniteData, type QueryClient } from '@tanstack/react-query';

// GOOD
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
```

### 2. Import order: local services first, then external, then types
```ts
// BAD
import type { ... } from '@tanstack/react-query';
import { buildKeys } from '@/shared/infrastructure/query';
import type { ... } from '../api/chat.types';
import { chatService } from '../api/chat.service';

// GOOD
import { chatService } from '../api/chat.service';
import { chatMessageService } from '../api/chat-message.service';
import { buildKeys } from '@/shared/infrastructure/query';
import type { InfiniteData } from '@tanstack/react-query';
import type { ... } from '../api/chat.types';
```

### 3. Always use absolute paths for cross-module imports
Relative paths are only allowed within the same module.
```ts
// BAD
import clients from './clients';
import endpoints from './endpoints';

// GOOD
import clients from '@/modules/analysis/api/service/clients';
import endpoints from '@/modules/ai/api/service/endpoints';
```

---

## Exports

### 4. Export at declaration, never in a separate statement
```ts
// BAD
const chatsQuery = createQuery(...);
export { chatsQuery };

// GOOD
export const chatsQuery = createQuery(...);
```

---

## Functions

### 5. Pass functions by reference when there is no transformation
```ts
// BAD
export const dailyActivityQuery = createQuery(KEYS.activity, (params) => 
    dailyActivityService.getDailyActivity(params));

// GOOD
export const dailyActivityQuery = createQuery(KEYS.activity, 
    dailyActivityService.getDailyActivity);
```

### 6. Never use `void` to discard a return value
```ts
// BAD
void someFunctionCall();

// GOOD
someFunctionCall();
```

---

## Types, Interfaces & Classes

### 7. Always close interfaces with a semicolon
```ts
// BAD
interface Foo {
    bar: string;
}

// GOOD
interface Foo {
    bar: string;
};
```

### 8. Always close classes with a semicolon
```ts
// BAD
class SomeClassName {
    ...
}

export abstract class SomeClassName {

}

export abstract class SomeClassName extends SomeOtherClassName {

}

// GOOD
class SomeClassName {

};

export abstract class SomeClassName {

};

export abstract class SomeClassName extends SomeOtherClassName {

};
```

### 9. Never use anonymous inline types — always name them
```ts
// BAD
get<{ containerId: string }, Result[]>(...)

// GOOD
interface GetContainerParams {
    containerId: string;
};

get<GetContainerParams, Result[]>(...)
```

Before creating a new interface, search the codebase for an existing one
that matches. Reuse always beats redeclare.

### 10. Use enums instead of string union types
```ts
// BAD
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

// GOOD
export enum JobStatus {
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
};
```

---

## Objects

### 11. Multi-line objects when they have more than 2 properties
```ts
// BAD
const obj = { a: 1, b: 2, c: 3, d: 4 };

// GOOD
const obj = {
    a: 1,
    b: 2,
    c: 3,
    d: 4
};
```

Single-line is acceptable only for objects with 1–2 short properties.

---

## Comments

### 12. Use JSDoc comments instead of divider banners
```ts
// BAD
// ---------------------------------------------------------------------------
// Paginated page helpers
// ---------------------------------------------------------------------------

// GOOD
/** Paginated page helpers */
```

### 13. Declare interfaces and types at the top of the file, after imports
```ts
// BAD
import { ... } from '...';

export class SomeClass {

};

interface SomeClassParams {
    id: string;
};

// GOOD
import { ... } from '...';

interface SomeClassParams {
    id: string;
};

export class SomeClass {

};
```

The file should follow this order:
1. Imports
2. Interfaces and types
3. Enums
4. Classes, functions, and constants

This makes contracts immediately visible when opening a file, and avoids 
having to scroll through implementation to understand what shapes the module 
works with.

### 14. Keep single imports inline, split only when necessary
```ts
// BAD
import type {
    AIMessageArtifact
} from '@/modules/ai/api/entities/ai-conversation';

// GOOD
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
```

NOTE: Only split into multiple lines when the imports exceed 4 or become unreadable 
on a single line:

### 15. Prefer if/let blocks over ternaries for complex expressions
```ts
// BAD
const columns = Array.isArray(artifact.payload.columns)
    ? artifact.payload.columns.filter((column): column is string => typeof column === 'string')
    : [];

// GOOD
let columns = [];
if (Array.isArray(artifact.payload.columns)) {
    columns = artifact.payload.columns.filter((column): column is string => typeof column === 'string');
};
```

Ternaries are acceptable only when both branches are simple values:
```ts
const label = isActive ? 'Active' : 'Inactive';
```

### 16. Never define block-body functions inside JSX
```tsx
// BAD
{columns.map((col, colIndex) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
    const key = cellKey(rowIndex, colIndex);
    return <SheetCell key={col} isEditing={isEditing} cellKey={key} />;
})}

// GOOD
const renderCell = (col: string, colIndex: number) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
    const key = cellKey(rowIndex, colIndex);
    return <SheetCell key={col} isEditing={isEditing} cellKey={key} />;
};

{columns.map(renderCell)}
```

Simple arrow expressions without a block body are acceptable:
```tsx
{columns.map((col) => <td key={col}>{col}</td>)}
```

### 17. Never write defensive normalization functions — trust the server contract

Functions that validate or normalize values that come from the server are noise. If the server defines a contract, the client must trust it blindly. These functions add indirection, inflate complexity, and imply distrust where none is warranted.

```ts
// BAD — the server already guarantees this shape, this check is dead weight
export const normalizeAnalysisStatus = (status: string | undefined): AnalysisStatus | undefined => {
    if (status === 'pending' || status === 'running' || status === 'completed' || status === 'failed') {
        return status;
    }
    return undefined;
};

// GOOD — use the value directly, typed at the boundary
const status: AnalysisStatus = response.status;
```

Any function whose sole purpose is to re-validate, re-narrow, or re-map a value that originates from `server/` must be deleted. This includes:

- Status normalizers (`normalizeX`, `parseX`, `sanitizeX`)
- Fallback mappers that guard against values the server never produces
- Conditional chains that mirror an enum the server already enforces

The type boundary lives in the API layer. If the server breaks its contract, the bug belongs to the server — not to a guard buried in the client that silently swallows it.

### 18. Never cast types with `as` to satisfy a signature — fix the signature instead

Type casting with `as` is a red flag. It means the types disagree and instead of resolving the disagreement, the cast silences it. The result is code that lies to the compiler and becomes unreadable for anyone who follows.

```ts
// BAD — the cast hides a type mismatch and adds noise that serves no one
onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void {
    return this.socketService.on(SOCKET_EVENTS.metricsAll, callback as (...args: unknown[]) => void);
};

// GOOD — pass the value directly, the types already agree
onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void {
    return this.socketService.on(SOCKET_EVENTS.metricsAll, callback);
};
```

If a cast feels necessary, the real problem is one of these:

- The receiving function has a signature that is too wide — tighten it
- The types genuinely differ — align them at the source, not at the call site
- A generic was left unresolved — provide the type argument explicitly

`as` is never the fix. It is the symptom of a fix that was skipped.

### 19. Never use `any` — use `unknown` only at boundaries, and narrow it immediately

`any` disables the compiler entirely. Every value typed as `any` is a hole in the type system that rots outward — every consumer inherits the ambiguity. It has no acceptable use.

```ts
// BAD — any turns off the compiler silently
on(event: string, callback: (...args: any[]) => void): () => void;

// GOOD — name the shape with a generic
on<T>(event: string, callback: (payload: T) => void): () => void;
```

`unknown` is different — it is the honest way to represent a value whose shape is genuinely not known yet. It is acceptable **only** at external boundaries:

```ts
// GOOD — catch blocks, JSON.parse, and untyped third-party responses are legitimate unknown
try { ... } catch (error: unknown) {
    if (error instanceof Error) console.log(error.message);
};

const parsed: unknown = JSON.parse(raw);
```

The rule for `unknown` is: **narrow it in the same scope where it appears, never pass it through.** The moment `unknown` escapes its boundary into application logic, it becomes the same problem as `any`.

If a type feels hard to name, that is a signal the abstraction is wrong — not a reason to reach for `any` or unresolved `unknown`. The correct moves are:

- Use a generic when the shape varies by caller
- Define an interface when the shape is fixed
- Use a union when the shape is one of a known set


### 20. Default imports always come last within their group

Named imports precede default imports within the same import group. A default import is a different contract — it represents the module's primary export, not a named binding — and placing it last keeps that distinction visible at a glance.

```ts
// BAD — default import mixed in before named imports from the same group
import { useCallback, useEffect, useRef } from 'react';
import useSocket from '@/modules/socket/hooks/use-socket';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/api/entities/socket-constants';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

// GOOD — named imports first, default import last
import { useCallback, useEffect, useRef } from 'react';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/api/entities/socket-constants';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useSocket from '@/modules/socket/hooks/use-socket';
```

This applies within each group defined in rule 2. The overall group order does not change — defaults do not float to the bottom of the entire import block, only to the bottom of the group they belong to.

### 21. Never define imports inside functions

Imports belong at the top of the file. Placing them inside a function hides dependencies, makes the module graph impossible to trace at a glance, and signals a circular dependency problem that is being worked around instead of solved.

```ts
// BAD — dependencies are buried inside the function body, invisible at the module boundary
loadModels: async (_preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex, signal) => {
    const { timestepData } = get();
    if (!timestepData.timesteps.length) return {};

    const { useTeamStore } = await import('@/modules/team/stores/use-team-store');
    const { useEditorStore } = await import('@/modules/canvas/stores/editor');
    const { default: queryClient } = await import('@/shared/infrastructure/query/query-client');
    const { TRAJECTORY_QUERY_KEYS } = await import('@/modules/trajectory/hooks/queries');
};

// GOOD — all dependencies declared at the top of the file
import { useTeamStore } from '@/modules/team/stores/use-team-store';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import queryClient from '@/shared/infrastructure/query/query-client';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/queries';

loadModels: async (_preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex, signal) => {
    const { timestepData } = get();
    if (!timestepData.timesteps.length) return {};
};
```

If dynamic imports feel necessary to avoid a circular dependency, the circular dependency is the real problem — fix the module boundaries, do not paper over them with lazy imports.

The only acceptable use of dynamic `import()` is for genuine code-splitting at route or bundle level, never to resolve dependency ordering issues at runtime.

### 22. Use TSDoc for all documentation comments

TSDoc is the standard for documenting TypeScript code. Use it for all public
functions, classes, interfaces, and types where intent, edge cases, or contracts
are not self-evident from the signature alone.
```ts
// BAD — plain comment, not tooling-friendly, no structure
// Gets paginated jobs for a container. Throws if container not found.
async function getJobs(id: string, page: number, status?: string) { ... }

// GOOD
/**
 * Retrieves a paginated list of jobs associated with a container.
 *
 * @param containerId - The unique identifier of the container.
 * @param page - The page index (1-based).
 * @param status - Optional filter by job status. Returns all statuses if omitted.
 * @returns A paginated result with the matching jobs.
 * @throws {ContainerNotFoundError} If no container exists for the given `containerId`.
 *
 */
async function getJobs(
    containerId: string,
    page: number,
    status?: JobStatus
): Promise<PaginatedResult<Job>> { ... }
```

**Tags to use:**
- `@param` — describe each parameter when its purpose is not obvious from the name
- `@returns` — describe the return value when it is not self-evident from the type
- `@throws` — document every known thrown error with its type and condition

**Do not document the obvious.** A function named `isAuthenticated` returning
`boolean` needs no TSDoc. Apply it only where a future reader would otherwise
have to trace the implementation to understand intent, constraints, or failure modes.

### 23. Never type arrays with inline object shapes — always name the element type

An array type is only as readable as its element type. Inlining the shape 
directly on the array declaration hides the contract, bloats the declaration, 
and prevents reuse.
```ts
// BAD — the shape is anonymous, unreadable, and impossible to reuse
const sliders: { key: string; label: string; min: number; max: number; value: number }[] = [
    { key: 'position', label: 'Position', min: 0, max: 1, value: position },
];

// GOOD — the shape is named, declared once, and reusable
interface SliderConfig {
    key: string;
    label: string;
    min: number;
    max: number;
    value: number;
};

const sliders: SliderConfig[] = [
    {
        key: 'position',
        label: 'Position',
        min: 0,
        max: 1,
        value: position
    },
];
```

This is rule 9 applied to arrays. The same principle holds: if a shape 
appears inline, it belongs in a named interface declared at the top of the file.

### 24. A component is too large when it owns more than one responsibility

A component that fetches data, manages form state, handles business logic, 
and renders UI is four components pretending to be one. Size is a symptom — 
the real violation is mixed responsibility.

Split when a component does more than one of these:
- Fetches or mutates data
- Owns modal or form state
- Contains derived business logic (`useMemo`, `useCallback` beyond display concerns)
- Renders more than one distinct visual region

**The pattern:**
```
{FeatureName}/
    index.ts                         ← re-export only
    {FeatureName}.tsx                ← composes the pieces, owns nothing
    use-{feature-name}.ts            ← all state, queries, handlers
    {FeatureName}Modal.tsx           ← isolated modal with its own hook
    {FeatureName}List.tsx            ← pure or near-pure rendering
```
```tsx
// BAD — one component owns queries, modal state, handlers, and JSX
const IntegrationsSettings: React.FC = () => {
    const teamId = useSelectedTeamId();
    const { data } = useTeamAIIntegrationsQuery(teamId);
    const [modalProvider, setModalProvider] = useState(null);
    const [modalApiKey, setModalApiKey] = useState('');
    // 8 more state declarations, 6 handlers, 200 lines of JSX
    // including the modal, the list, and the empty state — all inline
};

// GOOD — responsibility is distributed
const IntegrationsSettings: React.FC = () => {
    const vm = useIntegrationsSettings();
    return (
        <SettingsPage title='Integrations'>
            <IntegrationsList vm={vm} />
            <IntegrationModal vm={vm} />
        </SettingsPage>
    );
};
```

The hook (`use-{feature-name}.ts`) owns all state, queries, and handlers, 
typed as a named interface:
```ts
interface IntegrationsSettingsVM {
    integrations: TeamAIIntegration[];
    isLoading: boolean;
    canAddProvider: boolean;
    onOpenCreate: () => void;
    onOpenEdit: (integration: TeamAIIntegration) => void;
    onRemove: (provider: AIProvider) => Promise<void>;
    // ...
};
```

Each sub-component receives `vm` as a prop and renders only. Distinct visual 
regions — list, modal, empty state, skeleton — each live in their own file. 
A JSX block that requires scrolling to read is a component waiting to be extracted.

A component that cannot be understood in under 30 seconds needs to be split.

### 25. A `.tsx` file must define exactly one component

One file, one component — no exceptions. A file that defines multiple 
components, even unexported ones, scatters responsibility and signals that 
extraction was deferred instead of done.
```tsx
// BAD — two components defined in the same file, even if only one is exported
const ProviderRow: React.FC<ProviderRowProps> = ({ integration }) => (
    <Container className='provider-row'>
        <Paragraph>{integration.providerName}</Paragraph>
    </Container>
);

const IntegrationsList: React.FC<IntegrationsListProps> = ({ vm }) => (
    <Container>
        {vm.integrations.map((integration) => (
            <ProviderRow key={integration.provider} integration={integration} />
        ))}
    </Container>
);

export default IntegrationsList;

// GOOD — one component per file, always
// ProviderRow/index.tsx
const ProviderRow: React.FC<ProviderRowProps> = ({ integration }) => (
    <Container className='provider-row'>
        <Paragraph>{integration.providerName}</Paragraph>
    </Container>
);

export default ProviderRow;

// IntegrationsList/index.tsx
import ProviderRow from '../ProviderRow';

const IntegrationsList: React.FC<IntegrationsListProps> = ({ vm }) => (
    <Container>
        {vm.integrations.map((integration) => (
            <ProviderRow key={integration.provider} integration={integration} />
        ))}
    </Container>
);

export default IntegrationsList;
```

If a component feels too small to deserve its own file, that is a signal 
it should not exist yet — not a reason to inline it. Always try to reuse components.

### 26. Never define JSX or arrays inline as prop values — extract them first

Props that receive JSX or arrays inline turn a component call into a 
nested document. The structure becomes unreadable and the values become 
impossible to name, test, or reuse.

Extract to named variables before the JSX block. The prop receives a 
reference, never a definition.
```tsx
// BAD — JSX and array defined inline as prop values
<ContextMenuPopover
    trigger={(
        <Container className='...' onClick={() => onSelectScene(scene, analysis)}>
            <Atom style={{ width: 12, height: 12 }} />
            <span>{exposure.name}</span>
        </Container>
    )}
    options={[
        { label: 'Add to scene', onClick: () => onAddScene(scene), disabled: isActive },
        { label: 'Remove from scene', onClick: () => onRemoveScene(scene), disabled: !isActive }
    ]}
/>

// GOOD — extracted to named variables, props receive references
const trigger = () => (
    <Container className='...' onClick={() => onSelectScene(scene, analysis)}>
        <Atom style={{ width: 12, height: 12 }} />
        <span>{exposure.name}</span>
    </Container>
);

const options: ContextMenuOption[] = [
    { 
        label: 'Add to scene', 
        onClick: () => onAddScene(scene), 
        disabled: isActive 
    },
    { 
        label: 'Remove from scene', 
        nClick: () => onRemoveScene(scene), 
        disabled: !isActive 
    }
];

<ContextMenuPopover trigger={trigger} options={options} />
```

This applies to any prop whose value requires more than one line to define.
Single-line JSX expressions and short inline callbacks remain acceptable.

### 27. Never redeclare CSS properties that already exist as utility classes

`client/src/shared/presentation/assets/stylesheets/general.css` provides utility classes for layout, spacing, typography, color, 
and more. `client/src/shared/presentation/assets/stylesheets/theme.css` provides all design tokens as CSS variables. Writing 
custom CSS that duplicates either is dead weight.

Before writing any CSS property in a component stylesheet, check if a utility 
class already covers it. If it does, apply it in `className` and omit the 
property from the stylesheet entirely.
```css
/* BAD — all of these are already covered by utilities */
.my-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm);
    background: var(--color-surface-1);
}

/* GOOD — only what the utilities cannot express stays in the stylesheet */
.my-container {
    background: var(--color-surface-1);
}
```
```tsx
{/* BAD */}
<Container className='my-container' />

{/* GOOD */}
<Container className='my-container d-flex column items-center gap-05 p-1 font-size-2 color-secondary radius-sm' />
```

The same rule applies to colors — never use raw hex or rgba values that 
correspond to a token in `theme.css`. Always use the variable.
```css
/* BAD */
.my-label {
    color: #6F717B;
}

/* GOOD */
.my-label {
    color: var(--color-text-secondary);
}
```

`client/src/shared/presentation/assets/stylesheets/theme.css`, `client/src/shared/presentation/assets/stylesheets/general.css`, and `client/src/shared/presentation/assets/stylesheets/base.css` are read-only. Never modify them.  
