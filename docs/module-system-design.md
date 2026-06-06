# Volt — Diseño del Sistema de Módulos Desacoplables

> **Estado:** propuesta de diseño (no implementado todavía).
> **Alcance:** `client/` + `server/`. Independiente del sistema de plugins de análisis científico (Volt-Registry / vpm-cli / VoltSDK / ClusterDaemon + `plugins/`).
> **Objetivo:** que el núcleo de Volt (la alternativa a OVITO) quede mínimo, y que las features sean **paquetes opcionales** instalables/desinstalables — con una disciplina uniforme que **todos** los módulos siguen, para máximo desacoplamiento y consistencia entre módulos.

---

## Tabla de contenidos

1. [Modelo mental](#1-modelo-mental)
2. [Las 3 leyes](#2-las-3-leyes)
3. [Core vs Installable](#3-core-vs-installable)
4. [La unidad: módulo = paquete](#4-la-unidad-módulo--paquete)
5. [El contrato público (`public.ts`)](#5-el-contrato-público-publicts)
6. [El manifest](#6-el-manifest)
7. [El registry y el boot](#7-el-registry-y-el-boot)
8. [Resolución de dependencias](#8-resolución-de-dependencias)
9. [La superficie `@volt/core`](#9-la-superficie-voltcore)
10. [Qué debe subir a core (consecuencia de la Ley 3)](#10-qué-debe-subir-a-core-consecuencia-de-la-ley-3)
11. [Enforcement](#11-enforcement)
12. [Plan de migración sobre el código existente](#12-plan-de-migración-sobre-el-código-existente)
13. [La frontera del daemon](#13-la-frontera-del-daemon)
14. [No-goals y riesgos](#14-no-goals-y-riesgos)
15. [Apéndice: estado de acoplamiento por módulo](#15-apéndice-estado-de-acoplamiento-por-módulo)

---

## 1. Modelo mental

**Un módulo es un paquete.** Las dependencias entre módulos son normales y están bien — exactamente como las `dependencies` de un `package.json`.

**"Desacoplable" NO significa "sin dependencias".** Significa lo que es un grafo de paquetes:

- Las dependencias entre módulos están **declaradas** (en el manifest, como un `package.json`).
- Solo se consumen por la **API pública** del otro módulo, nunca por sus internos.
- El grafo de dependencias es un **DAG** (sin ciclos).
- Puedes **quitar** un módulo si nada de lo que queda depende de él. Si quitas `container`, `scripting` también cae — y eso es *correcto*, no un bug. Es `npm uninstall`.

La disciplina es **idéntica para módulos core y para módulos installable**. Lo único que cambia es una bandera (`installable`) y una regla extra (el core no puede depender de un installable). Esa uniformidad es lo que da consistencia entre módulos y evita que el core vuelva a pudrirse después del refactor.

---

## 2. Las 3 leyes

Estas no son opiniones de estilo; son las reglas que hacen que un grafo de paquetes sea sano. Se hacen cumplir con tooling (ver [§11](#11-enforcement)).

### Ley 1 — El grafo es acíclico (DAG)

No se permiten ciclos de dependencia entre módulos. Los ciclos actuales **deben romperse**:

- cliente: `canvas ↔ raster` (canvas-service posee los endpoints de frame/metadata de raster mientras raster fetchea a través del data-access de canvas).
- servidor: `cluster ↔ container` (alrededor de la frontera del daemon).

### Ley 2 — Solo API pública + declarada

El módulo `a` puede importar de `b` **únicamente**:

1. a través de `b/public` (nunca rutas profundas como `modules/b/infrastructure/...`), **y**
2. solo si `b ∈ a.manifest.dependsOn`.

`@volt/core` y `shared/*` son la **raíz** del grafo: jamás importan hacia arriba a un `modules/*`.

### Ley 3 — Un paquete core no puede depender de uno installable

Si un módulo core depende de un módulo installable, ese módulo installable **no es opcional** (desinstalarlo rompe el core). Por tanto toda arista `core → installable` es ilegal, y la pieza concreta que el core necesita **debe subir a `@volt/core`** (ver [§10](#10-qué-debe-subir-a-core-consecuencia-de-la-ley-3)).

Esta ley **computa automáticamente** qué piezas refactorizar: corre el linter de boundaries con los installable marcados, y cada arista `core → installable` que ilumine es exactamente una pieza que mover a core.

---

## 3. Core vs Installable

Decisión de producto (fija):

| Categoría | Módulos |
|---|---|
| **Installable** (opcionales) | `ai`, `chat`, `container`, `latex`, `scripting` (depende de `container`), `whiteboards` |
| **Core** (siempre presentes) | `analysis`, `auth`, `canvas`, `cluster`, `daily-activity`, `dashboard`, `early-access`, `fractal`, `jobs`, `notification`, `onboarding`, `plugin`, `raster`, `session`, `simulation-cell`, `socket`, `system`, `team`, `trajectory` |

`cluster` es **core** y además **el kernel del daemon/almacenamiento/credenciales** — no se desinstala; su substrato sube a `@volt/core` como puertos y solo su UI (páginas/demo/transfer) permanece como feature interno del core.

**El contrato se aplica a los 25 módulos desde el día uno — no solo a los 6 installable.** Core e installable usan el mismo molde (`public.ts` + `manifest` + deps declaradas + DAG). La única diferencia es la bandera `installable` y la Ley 3 (el core no puede depender de un installable). El objetivo del plan es **conformidad universal**: cada módulo cumple el contrato. La *instalabilidad* de los 6 es entonces una consecuencia barata del final, no el motor del trabajo. Esto es lo que da consistencia entre módulos y, sobre todo, lo que impide que el core vuelva a pudrirse: una vez que el linter está en `error` global, el código nuevo no puede regresar a los viejos patrones.

---

## 4. La unidad: módulo = paquete

Cada módulo (core o feature, **mismo molde**) es tres cosas:

```
modules/<id>/
  public.ts            # lo ÚNICO que otros módulos pueden importar (los "exports")
  module.manifest.ts   # datos: id, deps, y lo que HOY se cablea a mano en el core
  ...resto             # interno; nadie de fuera lo toca
```

> **Fase actual: folder-as-package.** Los módulos siguen siendo carpetas bajo `client/src/modules/<id>` y `server/src/modules/<id>`, con alias `@modules/<id>` resolviendo a `@modules/<id>/public`. Promover a workspaces reales (`packages/@volt/module-*` con su propio `package.json`) es un movimiento **mecánico posterior** — necesario solo si quieres que sean publicables/instalables por terceros. La disciplina (API pública, deps declaradas, registry) es idéntica en ambos casos; solo cambia dónde viven los archivos.

---

## 5. El contrato público (`public.ts`)

`public.ts` es la frontera. Es la diferencia entre "exports del paquete" e "internos del `src/`".

**Servidor — interfaces + tokens + tipos/DTOs. NUNCA clases concretas:**

```ts
// server/src/modules/container/public.ts
export { CONTAINER_TOKENS } from './infrastructure/di/ContainerTokens';
export type { IContainerRuntime, IContainerService } from './domain/ports';
export type { ContainerDTO } from './application/dtos';
// La clase DaemonContainerRuntimeService NO se exporta: es interna.
```

Un módulo dependiente consume esto vía DI:

```ts
// server/src/modules/scripting/.../CreateScriptingJupyterSessionUseCase.ts
import { CONTAINER_TOKENS } from '@modules/container/public';
import type { IContainerRuntime } from '@modules/container/public';

@Singleton()
class CreateScriptingJupyterSessionUseCase {
    constructor(@inject(CONTAINER_TOKENS.Runtime) private runtime: IContainerRuntime) {}
}
```

Esto **es** una dependencia de paquete: `scripting` depende del contrato publicado de `container`, resuelto por el contenedor DI que ya existe. Lo único prohibido es importar la implementación concreta (igual que no importas archivos del `src/` interno de un paquete npm).

**Cliente — componentes/hooks/tipos públicos:**

```ts
// client/src/modules/container/public.ts
export { default as ClusterResourceSelectionPanel } from './components/ClusterResourceSelectionPanel';
export { useTeamClusterResourceSelection } from './hooks/use-team-cluster-resource-selection';
export type { ContainerSummary } from './api/entities/container';
```

**Regla de tipos pragmática:** los `import type` (tipos/DTOs) son libres entre módulos declarados (se borran en compile-time, no crean arista de runtime). El comportamiento (servicios) va por interfaz + token DI. No se dogmatiza puertos donde no aportan: la razón de usar interfaz+token en vez de la clase concreta es que **el DI ya requiere un token** y exponer la clase filtra internos y crea los ciclos/imposibilidad-de-desinstalar.

---

## 6. El manifest

El manifest **no reemplaza** el DI. Los servicios, use-cases y modelos siguen auto-registrándose con `@Singleton` / `@AliasOf` / `@CollectionMember` / `@Subscribe` vía el `autoload` de hoy. El manifest **solo carga lo que HOY se cablea a mano en el core** (los imports nombrados en `mount-http-routes.ts`, los `start()` en `server.ts`, la lista de broadcast, el enum de RBAC, las rutas en `definitions.ts`, los mounts del shell, etc.).

### Tipos

```ts
// server: @volt/core/server
export interface ServerModuleManifest {
    id: string;
    layer: 'core' | 'feature';
    installable: boolean;
    dependsOn: string[];              // ids de otros módulos (deps de paquete)
    requiresDaemon?: string;          // peer-version semver contra ClusterDaemon

    http?: HttpModule[];              // reemplaza el import a mano en mount-http-routes.ts
    rbac?: ResourceDescriptor[];      // { resource, actions, grants } -> registra en el catálogo RBAC
    buckets?: BucketDescriptor[];     // nombres de bucket que el módulo posee
    errorCodes?: ErrorCodeDescriptor[];
    broadcastEvents?: string[];       // nombres de eventos que se difunden a team-rooms
    runners?: Token<IStartableService>[];   // pollers/lifecycle; core hace resolveAll + start()
    wsUpgrades?: WsUpgradeDescriptor[];      // handlers de upgrade WS crudo (p.ej. Jupyter)
    daemonCommands?: string[];        // verbos ChannelCommands que el módulo aporta
    statProviders?: StatProviderDescriptor[];  // p.ej. per-member counts (invierte la arista team->repos)
    collectionPrefix?: string;        // namespacing de colecciones Mongo de 3os
}

// client: @volt/core/client
export interface ClientModuleManifest {
    id: string;
    layer: 'core' | 'feature';
    installable: boolean;
    dependsOn: string[];

    routes?: RouteConfig[];           // loaders lazy -> code-split automático
    nav?: NavContribution[];          // entradas de sidebar
    navIcons?: Record<string, ComponentType>;   // abre el enum cerrado DashboardNavigationIconKey
    tips?: TipDefinition[];           // abre la unión cerrada CONTEXTUAL_TIPS
    slots?: Record<string, () => Promise<{ default: ComponentType }>>;  // p.ej. 'canvas.workspace'
    storeResets?: (() => void)[];     // self-register en app-cleanup-registry
    preservedQueryKeys?: string[];    // self-register de prefijos de query a preservar en team-switch
    routeGuards?: RouteGuard[];       // p.ej. el gate de cluster-readiness
}
```

### Ejemplo (`container`)

```ts
// server/src/modules/container/module.manifest.ts
export const containerModule: ServerModuleManifest = {
    id: 'container',
    layer: 'feature',
    installable: true,
    dependsOn: ['cluster', 'team'],
    requiresDaemon: '>=1.2.0',
    http: [ContainerHttpModule],
    rbac: [{ resource: 'container', actions: ['read', 'create', 'update', 'delete'] }],
    broadcastEvents: ['container.created', 'container.updated', 'container.deleted'],
    runners: [CONTAINER_TOKENS.PortRelayLifecycle],
    daemonCommands: ['container.list', 'container.create', 'container.delete', /* ... */],
    statProviders: [{ key: 'containersCount', token: CONTAINER_TOKENS.Repo, groupBy: 'createdBy' }],
};
```

```ts
// client/src/modules/container/module.manifest.ts
export const containerModule: ClientModuleManifest = {
    id: 'container',
    layer: 'feature',
    installable: true,
    dependsOn: ['cluster', 'team'],
    routes: [/* RouteConfig[] con loaders lazy */],
    nav: [{ section: 'Main', label: 'Containers', iconKey: 'container', permission: 'container:read' }],
    navIcons: { container: ContainerIcon },
    storeResets: [() => useContainerStore.getState().reset()],
    preservedQueryKeys: ['container'],
};
```

---

## 7. El registry y el boot

Generaliza el patrón que **ya funciona** en el codebase: los socket modules se auto-registran vía `@AliasOf(SOCKET_TOKENS.SocketModule)` + `container.resolveAll(...)` en `server.ts`. Aplicamos lo mismo a TODO lo que hoy es `core → feature` a mano.

**Una sola lista nombra los módulos habilitados** (generada desde config):

```ts
// server/src/bootstrap/enabled-modules.ts  ← GENERADO desde volt.modules.json
import { containerModule } from '@modules/container/module.manifest';
import { latexModule } from '@modules/latex/module.manifest';
// ...core modules siempre presentes
export const ENABLED: ServerModuleManifest[] = [/* ...core */, containerModule, latexModule];
```

**El boot pliega los manifests en collection-tokens:**

```ts
// server/src/bootstrap/index.ts
const enabled = resolveDependencyClosure(ENABLED);  // como un package manager
assertAcyclic(enabled);                              // Ley 1
assertEveryDepEnabled(enabled);                      // "scripting requiere container" si falta
assertUniqueBasePaths(enabled);                      // no colisiones de rutas

for (const m of enabled) {
    registerHttpModules(m.http);
    registerRbacResources(m.rbac);
    registerBroadcastEvents(m.broadcastEvents);
    registerRunners(m.runners);
    registerWsUpgrades(m.wsUpgrades);
    registerDaemonCommands(m.daemonCommands);
    registerStatProviders(m.statProviders);
}
// mount-http-routes.ts deja de importar 40+ módulos por nombre: resuelve el HTTP_MODULE collection token.
```

**Cliente — el `ModuleRegistry` invierte los pulls estáticos del core:**

```ts
// client/src/bootstrap/register-modules.ts  ← GENERADO
export const ENABLED: ClientModuleManifest[] = [/* ...core */, containerModule, latexModule];

// app boot
ENABLED.forEach(registerModule);   // llena routes, nav, slots, storeResets, tips, guards
// RouteRenderer lee ModuleRegistry.routes (loaders lazy -> sigue habiendo code-split)
// DashboardLayout/SidebarNavigation renderizan nav + SLOTS con nombre
// app-cleanup-registry recibe los storeResets via registerTeamScopedStoreReset
```

Quitar un módulo = sacarlo del flag en `volt.modules.json`. El core nunca lo nombra.

---

## 8. Resolución de dependencias

Es, literalmente, un gestor de paquetes:

- Cada módulo declara `dependsOn: string[]`.
- El boot calcula el **cierre de dependencias** del set habilitado. Habilitas `scripting` ⇒ exige `container` (o error claro: *"scripting requires container"*).
- Deshabilitas `container` ⇒ `scripting` cae con él (o error si sigue habilitado).
- `scripting → container` es simplemente `dependsOn: ['container']`. Ambos installable ⇒ forman un **grupo de instalación** (no instalas uno sin el otro).
- El grafo debe ser DAG (Ley 1). Un ciclo = error de boot/lint.

---

## 9. La superficie `@volt/core`

`@volt/core` es el kernel/plataforma que **todo** módulo puede asumir presente. Es lo que nunca se desinstala.

**`@volt/core/client`**
- `registerModule(manifest)` + las APIs `register*` (`registerRoute` / `registerNavIcon` / `registerTip` / `registerSlot` / `registerRouteGuard` / `registerTeamScopedStoreReset` / `registerPreservedQueryKey`) y los tipos `RouteConfig` / `NavContribution` / `TipDefinition`.
- `createService` + `createApiClient` (la única costura al backend, con el resolver `setGetTeamId`).
- Familia de query factories: `createQuery` / `createPaginatedQuery` / `createInfiniteQuery` / `createMutation` / `createSocketQuery` sobre el `QueryClient` compartido.
- Design system: `Box` y primitives (`Button`/`Modal`/`Stack`/`Text`/`Loader` + `cn`) **más** `ResizeHandle` / `use-resizable` (hoy mal ubicados en `canvas`, hay que subirlos).
- Socket: `useSocket` / `useSocketEvent` / `useSocketRoom` + el singleton `socketService`.
- Identidad/contexto: `useCurrentUser` / `useSelectedTeam` / `useTeamPermissions` + los **tipos** de entidades de team/auth.

**`@volt/core/server`**
- Decoradores DI (`@Singleton`/`@Transient`/`@AliasOf`/`@CollectionMember`/`@Subscribe`) + el contenedor tsyringe.
- `IUseCase` / `Result`, familia `createController` + `BaseResponse`, `IBaseRepository`/`MongooseBaseRepository`, `IMapper`/`MongoBaseMapper`.
- `SHARED_TOKENS` ports: `StorageService`, `EventBus`, y los **puertos del daemon-kernel** `ITeamClusterDaemonClient` / `TeamClusterObjectGatewayClient` / `DaemonCredentialGuard`.
- `AuthenticatedRequest` + middleware `protect` / `checkTeamMembership`.
- APIs de extensión: `registerHttpModule` / `registerResource` / `registerBroadcastEvent` / `registerStartable` / `registerWsUpgrade` / `registerDaemonCommand` / `registerStatProvider` / `registerCatalogFolderKind` / `registerBucket` / `registerErrorCode`.
- Puertos de lectura cross-module estables (`ITeamMemberRepository`, `ITrajectoryReadPort`, …) para que los módulos dependan de interfaces, no de clases hermanas concretas.

---

## 10. Qué debe subir a core (consecuencia de la Ley 3)

Por la Ley 3, estas piezas viven hoy *dentro* de módulos installable pero son consumidas por módulos core ⇒ **suben a `@volt/core`**:

| Pieza | Hoy en | Sube a core porque |
|---|---|---|
| `TeamClusterSelectionService` / selección de compute-cluster | `container` | la usan `trajectory`, `raster`, `plugin` (core) + otros. Container-*el-feature* (UI/CRUD/terminal) queda installable; el **puerto de selección** es core. |
| Contrato de AI-tools (`AITool` / `AIToolScope` / token) | `ai` | lo consumen los 9 AI-tools de `container`. Si `ai` y `container` son installable, el contrato no puede vivir en `ai`. (Hoy `shared/AITool` importa *hacia* `ai` → dep circular.) |
| Puertos del daemon (reverse-channel, object-gateway, credential-guard) | `cluster` | ya están bajo `SHARED_TOKENS`; hay que hacerlos puertos reales con `cluster` como provider DI, para que `shared/` deje de importar concretos de `cluster`/`container`. |
| `ResizeHandle` / `use-resizable` | `canvas` | primitives de layout que `ai` (y otros) consumen; pertenecen al design system de core. |
| StatProvider registry | (arista `team` → repos) | `team` hace `@inject` de tokens de repos de 4 features para contar items por miembro. Una sola inversión a un registry de stat-providers desbloquea los 4. |

No hay que decidirlo a mano: el linter de boundaries con los installable marcados ilumina exactamente estas aristas.

---

## 11. Enforcement

Sin tests, **el linter ES el contrato** (TS-strict no atrapa esto — la Ley 2 rompe en *runtime* por resolución DI).

**`dependency-cruiser`** (o `eslint-plugin-boundaries`) codifica las 3 leyes:

- Prohibir rutas profundas entre módulos: `modules/a/**` no puede importar `modules/b/**` salvo `modules/b/public`.
- Prohibir que `shared/**` y `@volt/core/**` importen `modules/**` (Ley 2, raíz del grafo).
- Validar `dependsOn`: una arista `a → b` requiere `b ∈ a.manifest.dependsOn`.
- Validar DAG (Ley 1): `doNotFollow` / detección de ciclos.
- Validar Ley 3: una arista `core → feature` es error.

**Asserts al boot** (porque el modelo de registry falla en silencio — un registro olvidado = ruta/runner no montado sin error):
- cada token DI declarado en un manifest resuelve,
- cada `basePath` HTTP es único,
- cada `dependsOn` está habilitado,
- el grafo del set habilitado es acíclico.

---

## 12. Plan de migración sobre el código existente

**Objetivo: conformidad universal.** No se rediseña: se **envuelve, declara, fuerza e invierte**, en una secuencia donde el build nunca se rompe, hasta que **los 25 módulos** cumplen el contrato. La extracción de los 6 installable es el paso final barato, no el motor.

### Definición de "hecho" (criterio de conformidad)

El trabajo termina cuando, de forma medible y forzada por CI:

1. `dependency-cruiser` pasa con **cero violaciones** sobre los 25 módulos (linter en modo `error`, gate de CI).
2. **Cada** módulo tiene `public.ts` + `module.manifest.ts`.
3. El grafo de dependencias entre módulos es un **DAG** (sin ciclos).
4. `shared/**` y `@volt/core/**` no importan **nada** de `modules/**`.
5. El core no importa **ningún** feature por nombre (todo vía registry).

Se trackea como un contador: **`N/25` módulos en verde**.

### Fases

| Fase | Acción | Alcance | Riesgo | ¿Rompe build? |
|---|---|---|---|---|
| **0 — Fundación de plataforma** | `@volt/core` como **fachada de re-exports** sobre `shared/*` + módulos core. `dependency-cruiser` codificando las 3 leyes en modo **warn** → produce el **inventario completo de violaciones de los 25**. Subir primitives mal ubicados (`ResizeHandle`/`use-resizable`) a core. | una vez | 🟢 bajo | No |
| **1 — Andamiaje universal** | `public.ts` + `module.manifest.ts` para **los 25** (re-exports baratos + datos espejando lo ya cableado). Alias `@modules/x` → `@modules/x/public`. Ahora cada módulo está *declarado* aunque aún no *limpio*. | **los 25** | 🟢 bajo | No |
| **2 — Flip core→registry** | Generalizar el patrón `SocketModule` a HTTP/runners/RBAC/broadcast/ws-upgrade/stat-providers + cliente routes/nav/slots/store-resets. El core deja de nombrar features (core e installable por igual). Asserts de boot. | una vez | 🟠 medio | No (mismo runtime) |
| **3 — Barrida de inversión** | Llevar las violaciones a **0** across los 25, **ordenado por el DAG** (ver abajo): (a) romper ciclos `canvas↔raster`, `cluster↔container`; (b) invertir los up-imports `shared→módulo`; (c) invertir las aristas `core→feature` (§10); (d) repuntar a API-pública/puerto **todas** las aristas cross-module restantes — incluidas `core↔core` (raster, trajectory, analysis, dashboard, jobs). Cada módulo pasa a `error` al quedar verde. | **los 25**, paralelizable | 🔴 alto (daemon/cluster) | Incremental |
| **4 — Lock + installable** | `dependency-cruiser` a `error` **global** (gate de CI permanente: el código nuevo ya no puede regresar). Marcar los 6 como `installable: true`, verificar que la Ley 3 se cumple, y gatear por `volt.modules.json` → **build-time-optional cae solo**. Pilotar deshabilitando `whiteboards`/`latex`/`chat`. | una vez + 6 | 🟠 medio | No |
| **5 — (Opcional)** | Runtime-install real vía Module Federation (host `@volt/core`, remotes por módulo). Solo si terceros externos deben instalar sin código fuente. | aparte | 🔴 muy alto | — |

### Orden de la barrida (Fase 3): de abajo hacia arriba en el DAG

Para repuntar `a → b` a la API pública de `b`, **`b` debe exponer ya su `public.ts`/puerto**. Por eso la barrida va bottom-up (de lo más-dependido a las hojas):

1. **Estabilizar `@volt/core` + los puertos del kernel** (daemon, object-gateway, credential-guard, `TeamClusterSelectionService`, contrato AI-tools, StatProvider). Así cada módulo tiene puertos estables sobre los que apoyarse.
2. **Romper ciclos** (`canvas↔raster`, `cluster↔container`) — bloquean todo lo demás.
3. **Conformar los módulos más-dependidos primero** (`team`, `trajectory`, el resto del kernel) para que sus dependientes ya tengan API pública limpia.
4. **Subir hacia las hojas** (los features y los módulos core poco-dependidos).

Como cada módulo es independiente una vez que sus dependencias exponen API pública, la Fase 3 es **paralelizable** (varios módulos a la vez) y **repetible** (el mismo patrón mecánico × 25) — buen candidato para repartir el trabajo.

**Piloto recomendado dentro de la Fase 4: `whiteboards`** — cero imports entrantes en cliente fuera del registro de rutas; en servidor es un módulo DDD de libro que ya se auto-registra; **no toca el vocabulario de comandos del daemon** (solo usa el object-gateway, ya puerto core tras la Fase 3). Es el primer `installable: true` a validar; `latex` y `chat` le siguen.

**Estimación (1 ingeniero) — conformidad universal de los 25:** Fases 0–2 ≈ 5–9 semanas (plataforma + andamiaje de los 25 + flip a registry). Fase 3 es la variable: **~2–4 días por módulo limpio**, pero los duros (`canvas`, `cluster`, `container`, `raster`, `scripting`, `ai`, `trajectory`, `dashboard`) son ~1–3 semanas cada uno → realistamente **+2–4 meses**. Fase 4 ≈ 2–3 semanas. **Total conformidad universal: ~6–9 meses** (vs ~3–5 meses si solo se conformaran los 6 installable). El sobrecosto compra una arquitectura **forzada permanentemente** — no re-rot, un único modelo mental por módulo — que es la verdadera victoria de carga cognitiva. Fase 5 es un proyecto multi-mes independiente.

---

## 13. La frontera del daemon

Es la parte más dura y **no debe reinventarse por módulo**.

Hoy: `cluster` posee el motor RPC reverse-channel (`TeamClusterReverseChannelService`); el vocabulario congelado `ChannelCommands` está **duplicado a mano** en `shared/infrastructure/contracts/team-cluster.ts` **y** en el paquete npm `@voltstack/daemon-cluster-client` del repo separado `ClusterDaemon`, **sin link en compile-time**; y `shared/` importa concretos de `cluster`.

Plan: promover el transporte del daemon a un **daemon-kernel en core** — `ITeamClusterDaemonClient` / `TeamClusterObjectGatewayClient` / `DaemonCredentialGuard` ya están bajo `SHARED_TOKENS`; convertirlos en puertos reales con `cluster` como provider DI. Cualquier módulo habla con el daemon **solo** por el puerto core. Los verbos específicos (`container.*`, `notebook.*`, `trajectory.rasterize`) se aportan vía `registerDaemonCommand(descriptor)`.

**Caveat permanente:** el repo `ClusterDaemon` debe implementar cada verbo de forma independiente; no hay contrato cross-repo forzado. Por eso un módulo installable que toque el daemon arrastra `requiresDaemon: '>=x.y.z'` en su manifest (restricción de peer-version, **no** una costura que se pueda cerrar del todo).

---

## 14. No-goals y riesgos

**No-goals**
- **No** construir Module Federation especulativamente. El objetivo realista y valioso es **build-time-optional** (Tier A). Runtime-install de terceros (Tier C) es un proyecto separado, grande y de alto riesgo; solo si un requisito externo lo materializa.
- **No** convertir `cluster` en "feature desinstalable". Es el kernel; su substrato sube a core, su UI queda como feature interno del core.
- **No** dogmatizar puertos donde no aportan: tipos/DTOs se importan libremente entre módulos declarados; solo el comportamiento (servicios) va por interfaz + token.

**Riesgos principales**
1. **Acoplamiento por token DI rompe en runtime, no en compile-time** — TS-strict (la única red de seguridad) no lo atrapa. → asserts de boot obligatorios.
2. **El SPA de Vite no carga código de terceros en runtime** sin Module Federation. Solo build-time-optional es incrementalmente alcanzable.
3. **Registries que fallan en silencio** — un registro olvidado = ruta/runner no montado. → asserts de boot.
4. **`container` es una base de cómputo oculta** — 6 módulos importan su `TeamClusterSelectionService`. "Extraer container" significa "subir `TeamClusterSelectionService` a core" primero.
5. **Acoplamiento por strings/enums es generalizado y fácil de subestimar** (`daily-activity` ActivityType, `populated-model-routes`, system-role seeds, `tip-registry`, `DashboardNavigationIconKey`, lista hardcodeada de `EventBroadcastSocketModule`, `CatalogFolderKind`). Ninguno bloquea por sí solo, pero cada uno es un edit-site del core que debe ir tras un registry.

---

## 15. Apéndice: estado de acoplamiento por módulo

Tiers de separabilidad (verificados contra el código). `clean/moderate` = candidatos limpios; `hard` = ciclos/vocabulario-daemon; `core-bound` = kernel.

| Módulo | Categoría | Tier | Bloqueador principal |
|---|---|---|---|
| `whiteboards` | installable | moderate | arista `team`→repo (count) + enums cerrados. Cliente: cero imports entrantes. **Piloto.** |
| `latex` | installable | moderate | igual que whiteboards; usa object-gateway (puerto core). |
| `chat` | installable | moderate | sin daemon; 2 bloqueadores (`application-store-cleanups`, `mount-http-routes`). |
| `ai` | installable | hard | `shared/AITool`→`ai` (circular); credenciales de proveedor viven en `team`; el shell monta el panel sin gate. |
| `container` | installable | hard | ciclo `cluster↔container`; `TeamClusterSelectionService` lo usan 6 módulos. |
| `scripting` | installable | hard | `canvas` lo embebe estático (~15 condicionales); proxy WS de Jupyter en `server.ts`; verbos `notebook.*` en el contrato del daemon. Depende de `container`. |
| `cluster` | core (kernel) | core-bound | posee el motor del daemon + object-gateway que 7+ módulos usan; `shared/` importa hacia arriba dentro de él. |
| `raster` | core | hard | ciclo duro con `canvas`; estado de raster filtrado al store de `jobs`. |
| `canvas` | core | — | shell de workspace de facto; embebe `scripting`/`raster`. Necesita un slot de workspace. |

---

*Fin del diseño. La implementación arranca por la Fase 0; el linter de boundaries (Fase 1) produce el inventario exacto de violaciones que hay que invertir.*
