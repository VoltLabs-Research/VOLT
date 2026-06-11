# Plan: consistencia de arquitectura en VOLT/server — "Port en todo"

> Estado: **PROPUESTA, sin ejecutar**. Nada se modifica hasta tu aprobación.
> Regla elegida: toda dependencia inyectada se tipa por su **interfaz (port)**, siempre, sin excepción.
> Modo: plan primero. Otro agente trabaja sin commitear en `trajectory`, `plugin`, `container`
> (+ algunos archivos sueltos) → esos quedan FUERA de alcance hasta que commitee.

---

## 1. La regla única (definición de "consistente")

Una dependencia se inyecta **siempre por su port**, nunca por la clase concreta:

```ts
// ❌ prohibido (estado actual en ~92 archivos)
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
constructor(@inject(TEAM_TOKENS.TeamRepository) private readonly repo: TeamRepository) {}

// ✅ regla
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
constructor(@inject(TEAM_TOKENS.TeamRepository) private readonly repo: ITeamRepository) {}
```

Tres invariantes que definen "hecho":

1. **Toda clase de `infrastructure/` (repository, service, gateway, mapper) implementa un port** `domain/port/I<Nombre>` con `implements`.
2. **Toda dependencia en un constructor de `application/` o `infrastructure/` se tipa por el port `I*`**, no por la clase.
3. **El único sitio que conoce la clase concreta es el token de DI** (el `@Singleton(TOKEN)` sobre la clase y el `@inject(TOKEN)` en el constructor). El token sigue importándose de `infrastructure/di` — eso es correcto y no cambia.

El patrón ya existe en su forma ideal y lo tomamos como canon:
`IPasswordHasher → BcryptPasswordHasher`, `ITokenService → JwtTokenService`,
`IStorageService → MinioStorageService`. Propagamos ESO a todo el server.

---

## 2. Diagnóstico medido (estado actual)

| Métrica | Valor |
|---|---|
| Imports `application → infrastructure/di` (tokens, **legítimos**, se conservan) | 353 |
| Imports `application → infrastructure/persistence` (clase repo concreta, **viola**) | 88 |
| Imports `application → infrastructure/services` (clase service concreta, **viola**) | 30 |
| **Total violaciones de la regla** | **118 imports** (~92 archivos) |
| Repos/services que **ya tienen** port `I*` (solo cambiar el import) | 27 |
| Repos/services **sin** port (hay que crear la interfaz) | 12 |
| Ports que son en realidad bolsas de tipos mal ubicadas | ~8 |

Violaciones por módulo (las marcadas 🚫 son del otro agente → excluidas por ahora):

```
  24  team
  18  trajectory   🚫 WIP
  17  plugin       🚫 WIP
   8  whiteboards
   7  latex
   4  analysis
   3  container    🚫 WIP
   3  cluster
   3  ai
   2  chat
   1  scripting
   1  dashboard
   1  daily-activity
```

Alcance ejecutable ahora (excluyendo WIP): **~57 archivos** en 10 módulos.

---

## 3. Trabajo por tipo

### 3a. Crear los 12 ports que faltan
Para cada clase sin interfaz, crear `domain/port/.../I<Nombre>.ts` extrayendo su superficie
pública (métodos públicos) y añadir `implements I<Nombre>` a la clase. Los repos heredan de
`IBaseRepository<T>` (ya existe) para no reescribir CRUD.

Faltan (fuera de WIP):
- **team**: `TeamRoleRepository`, `SecretKeyRepository`, `TeamInvitationRepository`, `TeamAIIntegrationRepository`
- **whiteboards**: `WhiteboardFolderRepository`
- **system**: `SystemMetricsRedisRepository`
- **cluster**: `StoragePlacementRepository`
- (WIP, diferidos: `TrajectoryFrameRepository`, `TrajectoryCloneJobRepository`, `TrajectoryFolderRepository`, `TrajectoryUploadSessionRepository`, `PluginRepository`)

### 3b. Reescribir los ~57 imports a su port
Mecánico pero **archivo por archivo** (D-013 prohíbe codemod ciego): cambiar el `import` de la
clase por `import type { I... }` y el tipo del parámetro en el constructor. El token `@inject`
no se toca. Verificación: `tsc` tiene que seguir verde (el token resuelve a la misma clase).

### 3c. Mover las ~8 "bolsas de tipos" fuera de `domain/port`
`IContainerService.ts` y similares no son contratos: exportan `ContainerPortMapping`,
`ContainerStats`, etc. Mover esos tipos a `domain/<modulo>-types.ts` (o `application/dtos` según
encaje) y reapuntar los imports. Esto NO crea ni borra comportamiento; solo deja de fingir que
un type-bag es un port. (Varios de estos están en `container` 🚫 → diferidos.)

### 3d. Normalizar 2 detalles menores de ubicación
- Servicios en `application/services/` que son infraestructura → mover a `infrastructure/services/`
  (afecta `cluster`; `trajectory` diferido). Solo si no roza WIP.
- Dejar `utilities/` fuera de este plan (es cosmético, otra pasada).

---

## 4. Orden de ejecución (por olas, módulos seguros primero)

Cada módulo es una unidad atómica: crear ports faltantes → reescribir imports → `tsc` verde → siguiente.

| Ola | Módulos | Por qué | Archivos aprox |
|---|---|---|---|
| **0 — piloto** | `whiteboards` | aislado, 8 violaciones, 1 port a crear, lejos del WIP | ~9 |
| **1** | `auth`, `chat`, `ai`, `analysis` | módulos canónicos, pocos ports faltantes | ~16 |
| **2** | `latex`, `scripting`, `daily-activity`, `dashboard` | medianos, sin solape con WIP | ~10 |
| **3** | `team` | el más grande (24), pero independiente del WIP | ~24 |
| **4** | `cluster` (parte no-WIP), `system` | revisar que no toque archivos del otro agente | ~5 |
| **DIFERIDO** | `trajectory`, `plugin`, `container` | 🚫 el otro agente los edita sin commitear | ~38 |

Tras cada ola: `npx tsc -p tsconfig.json --noEmit` debe dar exit 0 (baseline actual: verde).

---

## 5. Salvaguardas (D-013)

- **Sin codemod global.** Cada archivo se edita y se revisa individualmente.
- **WIP intocable.** Antes de cada ola, `git status` para reconfirmar qué archivos están sin
  commitear; cualquiera que aparezca se excluye en caliente.
- **Verificación por ola**, no al final. Si una ola rompe `tsc`, se arregla antes de seguir.
- **Reversible.** Son cambios de tipos/imports + archivos de interfaz nuevos; sin cambio de
  comportamiento en runtime (el token de DI resuelve a la misma clase concreta).
- **Sin tocar copy/UI/feature.** Puramente estructural.

---

## 6. Resultado esperado

- Regla única y verificable en los 10 módulos seguros (y los 3 restantes cuando el WIP commitee).
- Se pueden añadir tests con mocks contra los ports (hoy hay 0 tests en server).
- Coste honesto: este camino **añade** ~12 archivos de interfaz y toca ~57; no reduce el conteo
  de archivos. Lo que compra es **consistencia total** (una sola vara de medir) y testabilidad,
  que es lo que pediste. La alternativa "menos archivos" era la alternativa A (port solo en I/O),
  que descartaste.

---

## 7. Lo que NO hace este plan

- No borra interfaces (elegiste conservarlas todas).
- No toca el wiring HTTP, `createController`, DI, autoload, `Result`, `ApplicationError` — están bien.
- No reorganiza `utilities/` ni renombra módulos.
- No entra en `trajectory`/`plugin`/`container` hasta que el otro agente commitee.
