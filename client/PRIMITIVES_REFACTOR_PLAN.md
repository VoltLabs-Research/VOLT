# Plan de diseño + migración de primitivos — Volt/client

**Objetivo**: consolidar un set canónico de primitivos que emiten **exactamente las mismas clases CSS que ya usa hoy la app**, migrar todo el código a usarlos con sub-agentes en paralelo, y eliminar `volt-container`/`volt-title`/`volt-text` + las cadenas de utilities repetidas. **Cero cambio visual.**

---

## Contexto y diagnóstico

### Sistema CSS existente (sólido, se conserva)

- `src/shared/presentation/assets/stylesheets/theme.css` (201 L): variables de color, radius, timing, z-index, breakpoints para `light` y `dark`.
- `src/shared/presentation/assets/stylesheets/general.css` (671 L): utility-first casero — `d-flex`, `column`, `gap-*`, `items-*`, `content-*`, `p-*`, `m*-*`, `radius-*`, `font-size-*`, `font-weight-*`, `color-*`, `b-soft`, `transition-*`, variantes `sm:*` responsivas.
- `src/shared/presentation/assets/stylesheets/base.css` (163 L): reset + `primary-surface`, `glass-bg`, `card-elevated`, `text-truncate`, `zone-danger|warning`.

### Problema cuantificado (grep sobre el repo)

- `volt-container`: **1,258 ocurrencias en 296 archivos**. 0 reglas CSS. Marcador muerto.
- `volt-title` + `volt-text`: **411 ocurrencias en 141 archivos**. 0 reglas CSS.
- `<div className="d-flex ...">`: **717 usos**. `d-flex` aparece **984 veces**.
- `<h1..h6>` + `<p>` con className: **424 usos**. `<span className=...>`: **341 usos**.
- Cadenas repetidas top: `volt-container d-flex column gap-05`, `volt-container d-flex items-center gap-05`, `volt-container d-flex content-between items-center`, `volt-title font-size-3 font-weight-5 color-primary`, `font-size-2 color-secondary line-height-5`.

---

## 0. Invariantes del plan (garantía de "mismo diseño visual")

1. **Ningún CSS nuevo**. Los primitivos SOLO concatenan clases existentes vía `cn()`.
2. **Render output estable**. Mapping 1:1 prop → className contra utilities actuales.
3. **Passthrough completo**: `className`, `style`, `ref`, `data-*`, `aria-*`, props HTML nativas van al elemento raíz.
4. **Componentes de dominio/infra NO se tocan** (Sidebar*, Terminal, CodeEditor, FileExplorer, Chart*, GlobalContextMenu, etc.).
5. **Se conservan** classNames de dominio (`sidebar-nav-icon`, `collapsible-section-header`, etc.) vía `className` extra.

---

## 1. Inventario completo de primitivos

### 1.1 Nuevos primitivos a crear — **Layout & Typography (Tier 1)**

Ubicación: `src/shared/presentation/primitives/`. Estos son los que atacan las 1,669 ocurrencias de marcadores + cadenas de utilities.

| # | Primitivo | Reemplaza patrón | Prop keys principales |
|---|---|---|---|
| 1 | `<Box>` | `<div className='volt-container ...'>` genérico | `as`, `display`, `direction`, `align`, `justify`, `gap`, `p*`, `m*`, `radius`, `border`, `position`, `overflow`, `width`, `height`, `flex` |
| 2 | `<Stack>` | `d-flex column gap-*` | `gap`, `align`, `justify` (Box con direction='column') |
| 3 | `<Row>` | `d-flex items-center gap-*` | `gap`, `align`, `justify`, `reverse`, `wrap` |
| 4 | `<Text>` | `<span/p className='font-size-* font-weight-* color-*'>` | `as`, `size` (xs–3xl), `weight` (regular/medium/semibold/bold), `tone` (primary/secondary/muted/danger/brand), `align`, `truncate`, `lineHeight` |
| 5 | `<Heading>` | `<hN className='volt-title font-size-* font-weight-* color-primary'>` | `level` (1–6), `size`, `weight`, `tone`, `truncate` |
| 6 | `<Divider>` | `<div className='volt-divider volt-divider--horizontal|vertical'>` | `orientation`, `spacing` |
| 7 | `<Surface>` | `card-elevated`, `primary-surface`, `glass-bg`, `zone-danger`, `zone-warning` | `variant`, + todas las de Box |

**Tokens** (sin inventar, reutilizan sufijos de `general.css`):
- Spacing: `0 | 01 | 02 | 025 | 035 | 05 | 075 | 1 | 1-5 | 2 | 3`
- Radius: `xs | sm | md | lg | xl | 2xl | full`
- Font size: `xs | sm | md | lg | xl | 2xl | 3xl` → `font-size-05` … `font-size-6`
- Font weight: `regular | medium | semibold | bold` → `font-weight-4/5/5-5/6`
- Align: `start | center | end`
- Justify: `start | center | end | between | around`

**Render ejemplo**: `<Box as='section' display='flex' direction='column' gap='1-5' align='center'>` → `<section className='d-flex column gap-1-5 items-center'>`.

### 1.2 Nuevos primitivos a crear — **Forms (Tier 2)**

Cubren patrones inline sin primitivo hoy.

| # | Primitivo | Estado actual | Justificación |
|---|---|---|---|
| 8 | `<Input>` | No existe; se usa `<input>` inline o `FormFieldRHF` | Extraer átomo para inputs no-RHF |
| 9 | `<Textarea>` | No existe; ~5 `<textarea>` inline | Paralelo de Input |
| 10 | `<FormLabel>` | Embebido en FormFieldRHF | Reutilizable fuera de RHF |
| 11 | `<HelperText>` | Embebido en FormFieldRHF | Idem |
| 12 | `<ErrorText>` | Embebido en FormFieldRHF | Idem |

`FormFieldRHF` se mantiene como composición encima de estos.

### 1.3 Nuevos primitivos a crear — **Feedback & Content (Tier 3)**

| # | Primitivo | Estado actual | Justificación |
|---|---|---|---|
| 13 | `<Alert>` | No existe; ~9 `role='alert'` inline | Callout genérico con `tone` (info/success/warning/danger) |
| 14 | `<ProgressBar>` | No existe; ~7 `role='progressbar'` inline | Atómo de progreso lineal |
| 15 | `<Kbd>` | No existe; 3 usos `<kbd>` inline | Átomo cosmético para atajos (KeyboardShortcutsPanel, CommandPalette) |
| 16 | `<Link>` | No existe como wrapper estilizado; se usa `<Link>` de react-router directo | Router link con tone/underline unificado |
| 17 | `<Breadcrumb>` / `<BreadcrumbItem>` | `FolderBreadcrumbs`, `SSHBreadcrumbs`, `HeaderBreadcrumbs` duplican patrón | Primitivo genérico items+separator |
| 18 | `<Card>` | No existe; `b-soft radius-md p-1-5` repetido inline | Surface con estructura `header/body/footer` opcional |

**Huecos de menor prioridad** (no se crean en esta fase, quedan backlog): `Checkbox`, `Radio`, `Spinner` (Loader ya cubre), `Menu/MenuItem` (PopoverMenu cubre).

### 1.4 Primitivos existentes (átomos ya maduros) — **re-exportar desde `primitives/`**

Estos componentes **ya tienen API de variantes y son domain-agnostic**. No se reescriben ni se mueven físicamente (minimiza riesgo de imports rotos). Solo se **re-exportan** desde `src/shared/presentation/primitives/index.ts` para que los módulos consumidores tengan un único import canónico.

| # | Primitivo | Archivo fuente | Notas |
|---|---|---|---|
| 19 | `<Button>` | `components/Button/index.tsx` | Ya tiene `variant/intent/size/shape/block/align`. |
| 20 | `<IconButton>` | `components/IconButton/index.tsx` | `variant/size`. |
| 21 | `<Icon>` | `components/Icon/index.tsx` | Wrapper Lucide. |
| 22 | `<CloseButton>` | `components/CloseButton/index.tsx` | Atajo de Button+X. |
| 23 | `<Avatar>` | `components/Avatar/index.tsx` | `size/src/fallback`. |
| 24 | `<Loader>` | `components/Loader/index.tsx` | Spinner con `scale`. |
| 25 | `<Skeleton>` | `components/Skeleton/index.tsx` | `variant/animation`. |
| 26 | `<Slider>` | `components/Slider/index.tsx` | min/max/step. |
| 27 | `<Switch>` | `components/LiquidToggle/index.tsx` re-exportado como `Switch` | aria-pressed, controlled/uncontrolled. El nombre "LiquidToggle" se mantiene como export legacy. |
| 28 | `<Badge>` | `components/StatusBadge/index.tsx` re-exportado como `Badge` | Ya tiene `variant/size`. Alias `StatusBadge` se mantiene. |
| 29 | `<StatusDot>` | `components/StatusDot/index.tsx` | Punto cromático. |
| 30 | `<Tooltip>` | `components/Tooltip/index.tsx` | Content/placement/delay. |
| 31 | `<Popover>` | `components/Popover/index.tsx` | Primitivo flotante. |
| 32 | `<Modal>` | `components/Modal/index.tsx` | Dialog genérico. |
| 33 | `<SegmentedTabs>` | `components/SegmentedTabs/index.tsx` | Tabs genéricos por id/label. |
| 34 | `<Stepper>` | `components/Stepper/index.tsx` | Genérico `<K>`. |
| 35 | `<Table>` / `<TableRow>` | `components/Table/index.tsx` | Tabla genérica `<T>`. |
| 36 | `<SearchInput>` | `components/SearchInput/index.tsx` | Input con icono. |

**Total primitivos disponibles**: 18 nuevos (Tier 1–3) + 18 re-exportados = **36 primitivos** bajo `@/shared/presentation/primitives`.

### 1.5 Componentes que se quedan como COMPOSED (no primitivo)

Reutilizables pero compuestos de primitivos + lógica. Siguen en `components/`:

`AccessDenied`, `AvatarStack`, `CollapsibleSection`, `ConfirmActionModal`, `ContextMenuPopover`, `CopyableField`, `CursorTooltip`, `DangerZone`, `DeferredExplorerState`, `DocumentListing*`, `EditableKeyValueCard`, `EditableTag`, `EmptyState`, `ErrorPage`, `FileAttachment`, `FileUploaderContainer`, `FolderBreadcrumbs`, `FormFieldRHF`, `FormSection`, `IconPicker`, `DynamicIcon`, `ModalFooterActions`, `MoveToFolderModal`, `NewFolderModal`, `NotFoundState`, `PanelHeader`, `PopoverMenu`, `PopoverMenuItem`, `AsyncMenuItemWrapper`, `ProcessingLoader`, `RecoveryState`, `RefreshButton`, `RenameFolderModal`, `Select`, `SettingsPage`, `SettingsSection`, `SettingsSectionHeader`, `TableSkeletonRow`, `ThemeToggleButton`, `WarningZone`, `WorkspaceToolbar`, `AutoScrollList`, `FileExplorer`, `ChartContainer`, `ChartTooltip`.

### 1.6 Componentes INFRASTRUCTURE (providers/boundaries)

No son UI atómica, no se tocan: `AppToaster`, `ErrorBoundary`, `GlobalContextMenu`, `GlobalErrorListener`, `QueryProvider`, `PageTransition`.

### 1.7 Componentes DOMAIN (acoplados a negocio)

No se tocan: `EmojiPicker`, `ListingUserCell`, `NetworkChart`, `Terminal`, `Sidebar` y sub-Sidebar, `PopulatedCellPopover`, `CodeEditor`, icons/ domain-specific.

---

## 2. Decisiones de diseño que preservan visual 1:1

1. Eliminar `volt-container` / `volt-title` / `volt-text` del JSX es seguro (grep: 0 reglas CSS).
2. `volt-divider--*` sí se conserva (tiene CSS en `general.css`).
3. `card-elevated`/`primary-surface`/`glass-bg`/`zone-*` se conservan (tienen CSS en `base.css`).
4. Ambigüedad: si un `<p>` tiene solo `color-muted` sin `font-size`, el agente NO fuerza un `size`; usa `<Text as='p' tone='muted'>` sin `size`.
5. Orden de clases es irrelevante (specificity por clase única).
6. `style={}` inline intacto. Refs y handlers intactos. `forwardRef` en todos los primitivos.
7. **Relocalización física de los 18 átomos existentes NO se hace en esta fase** — solo se re-exportan desde `primitives/index.ts`. Mover archivos es trabajo puramente mecánico y se puede hacer en un PR posterior sin impacto funcional.

---

## 3. Cronograma y fases

### Fase A — Fundación (serial, bloqueante)

#### A1. Implementar primitivos nuevos (Tiers 1–3)

Ubicación: `src/shared/presentation/primitives/`. 18 archivos:

- **Tier 1 (layout/typography)**: `Box`, `Stack`, `Row`, `Text`, `Heading`, `Divider`, `Surface`.
- **Tier 2 (forms)**: `Input`, `Textarea`, `FormLabel`, `HelperText`, `ErrorText`.
- **Tier 3 (feedback/content)**: `Alert`, `ProgressBar`, `Kbd`, `Link`, `Breadcrumb`, `Card`.

Regla: helper interno `buildBoxClasses(props): string` compartido por `Box`/`Stack`/`Row`/`Surface`/`Card`. `forwardRef` en todos. `Box` polimórfico con `as`. **Sin CSS nuevo, sin dependencias nuevas.**

#### A2. Producir `primitives/index.ts`

Re-exporta:
- Los 18 nuevos primitivos.
- Los 18 átomos existentes (`Button`, `IconButton`, `Icon`, `CloseButton`, `Avatar`, `Loader`, `Skeleton`, `Slider`, `Switch` (alias de LiquidToggle), `Badge` (alias de StatusBadge), `StatusDot`, `Tooltip`, `Popover`, `Modal`, `SegmentedTabs`, `Stepper`, `Table` + `TableRow`, `SearchInput`).

Import canónico para todos los agentes: `import { Box, Stack, Button, Avatar, ... } from '@/shared/presentation/primitives'`.

#### A3. Producir `PRIMITIVES_MIGRATION_SPEC.md` (efímero, para agentes)

Contenido:
- Tabla completa **prop → className emitida** por cada uno de los 18 primitivos nuevos.
- Lista de los 18 re-exportados con link al archivo fuente y su API canónica (leer del source).
- **30+ snippets antes/después** cubriendo los patrones top: `volt-container + d-flex`, heading, body text, divider, form field, alert, status badge, segmented tabs, avatar, etc.
- **Reglas de NO refactor** (no mover lógica, no tocar tests, no inventar tokens, no editar componentes de dominio/infra).
- **Checklist por archivo** que el agente ejecuta antes de marcar done.

#### A4. Smoke test manual (5 archivos representativos)

Migrar manualmente y validar outer HTML idéntico en DevTools:
- `NotFoundState` → Stack + Heading + Text + Row + Button.
- `EmptyState` → Stack + Heading + Text + Button.
- `SettingsSection` → Stack con border.
- `DangerZone` → Surface variant='danger' + Stack + Button.
- `SegmentedTabs` consumer de prueba (ej. uno de team/) → verifica import canónico.

Validar: `tsc --noEmit`, `npm run build`, diff HTML idéntico salvo marcadores. Ajustar API si algo no cuadra **antes** de lanzar agentes.

### Fase B — Migración paralela (11 sub-agentes)

#### B1. Partición disjunta

| # | Agente | Scope | Archivos aprox. |
|---|---|---|---|
| 1 | `migrate-shared` | `src/shared/presentation/components/**` (no `primitives/`) | ~100 |
| 2 | `migrate-ai` | `src/modules/ai/**` | ~40 |
| 3 | `migrate-cluster-container` | `src/modules/cluster/**`, `src/modules/container/**` | ~45 |
| 4 | `migrate-auth-onboarding` | `src/modules/auth/**`, `src/modules/onboarding/**`, `src/modules/session/**` | ~25 |
| 5 | `migrate-chat-notification` | `src/modules/chat/**`, `src/modules/notification/**` | ~25 |
| 6 | `migrate-canvas-raster-fractal` | `src/modules/canvas/**`, `src/modules/raster/**`, `src/modules/fractal/**` | ~25 |
| 7 | `migrate-analysis-trajectory-cell` | `src/modules/analysis/**`, `src/modules/trajectory/**`, `src/modules/simulation-cell/**`, `src/modules/daily-activity/**` | ~35 |
| 8 | `migrate-dashboard-start-system` | `src/modules/dashboard/**`, `src/modules/start/**`, `src/modules/system/**` | ~25 |
| 9 | `migrate-jobs-scripting-latex` | `src/modules/jobs/**`, `src/modules/scripting/**`, `src/modules/latex/**` | ~25 |
| 10 | `migrate-plugin-misc` | `src/modules/plugin/**`, `src/modules/socket/**`, `src/modules/ssh/**`, `src/modules/team/**`, `src/modules/whiteboards/**` | ~30 |
| 11 | `migrate-app-core` | `src/app/**` | ~10 |

#### B2. Prompt base del agente (parametrizado con `<SCOPE>`)

> **Tarea**: migrar todos los `.tsx` dentro de `<SCOPE>` al set de primitivos definidos en `src/shared/presentation/primitives/index.ts`, siguiendo `PRIMITIVES_MIGRATION_SPEC.md` al pie de la letra.
>
> **Qué debes aplicar**:
> - Reemplazar `<div className='volt-container ...'>` por `Box`/`Stack`/`Row` según el patrón.
> - Reemplazar `<h1..h6 className='volt-title ...'>` por `Heading level=N`.
> - Reemplazar `<span/p className='font-size-* color-*'>` por `Text`.
> - Reemplazar divs con `card-elevated`/`primary-surface`/`glass-bg`/`zone-*` por `Surface variant='...'`.
> - Reemplazar `<div className='volt-divider ...'>` por `Divider`.
> - Reemplazar `role='alert'` inline por `Alert tone='...'`.
> - Reemplazar `role='progressbar'` inline por `ProgressBar`.
> - Reemplazar `<kbd>` por `Kbd`.
> - Reemplazar `<Link>` de react-router crudo + className de estilo por `Link` primitivo cuando haya estilos.
> - Reemplazar patrones de breadcrumb inline por `Breadcrumb`.
> - Reemplazar `<textarea>`/`<input>` inline fuera de RHF por `Textarea`/`Input`.
> - Cambiar imports de átomos ya existentes (`Button`, `Avatar`, `SegmentedTabs`, etc.) al canónico `@/shared/presentation/primitives` **sin cambiar ninguna prop**.
>
> **Reglas estrictas**:
> 1. NO edites fuera de `<SCOPE>`.
> 2. NO edites `src/shared/presentation/primitives/**`.
> 3. NO cambies lógica, handlers, effects, refs, imports no relacionados, orden de JSX, tests, CSS.
> 4. NO introduzcas tokens nuevos. Si un utility no tiene primitivo equivalente, déjalo en `className=`.
> 5. Conserva TODA className específica de dominio (`sidebar-nav-icon`, `collapsible-section-header`) vía `className` extra al primitivo.
> 6. Si un `.css` asociado queda vacío tras la migración (solo contenía marcadores), elimínalo Y quita su import.
>
> **Salida esperada**:
> - Archivos `.tsx` migrados dentro de `<SCOPE>`.
> - `tsc --noEmit` en `Volt/client` pasa.
> - Reporte: (a) archivos tocados, (b) LOC netas eliminadas (`git diff --stat`), (c) errores de tipo (0), (d) casos ambiguos no migrados y por qué.

#### B3. Aislamiento

- Preferido: cada agente en worktree separado (`isolation: "worktree"`). Merge secuencial.
- Alternativa: misma rama — scopes disjuntos garantizan ausencia de conflictos. Batch de 11 Agent() en una sola tool-call.

### Fase C — Verificación (serial)

#### C1. Comprobaciones automáticas (bloqueantes)

1. `grep -r "volt-container" src/` → **0 matches**.
2. `grep -r "volt-title\|volt-text" src/` → **0 matches**.
3. `cd Volt/client && tsc --noEmit` → limpio.
4. `npm run build` → limpio.
5. `grep -r "\.volt-" src/ --include='*.css'` → solo `volt-divider*`, `volt-modal*`, `volt-skeleton*`, `volt-tooltip*`, `volt-icon-button*`, `volt-resize-handle*` (tienen CSS real).

#### C2. Comprobación visual estructurada

Dev server + rutas smoke: `/auth/sign-in`, `/dashboard`, `/cluster`, `/container/:id`, `/ai`, `/chat`, `/onboarding`, `/team`, `/jobs`, `/settings`, `/canvas`. Snapshot manual por ruta.

#### C3. Consolidación

- Detectar utilities muertas en `general.css` → podar.
- Eliminar `PRIMITIVES_MIGRATION_SPEC.md`.
- Opcional: regla ESLint prohibiendo `volt-container`.
- **Opcional follow-up PR**: mover físicamente los 18 átomos desde `components/` a `primitives/` y actualizar imports directos residuales.

### Fase D — Métricas

Antes/después:
- LOC en `src/modules/**` y `src/shared/presentation/components/**`.
- Ocurrencias de `volt-container` (1,258 → 0), `volt-title`+`volt-text` (411 → 0).
- Tamaño de bundle (`vite build`) — no debe crecer.

---

## 4. Estimación de líneas eliminadas

Medido sobre baseline real: 64,321 LOC en scope.

| Fuente | Líneas eliminadas (rango) |
|---|---|
| Colapso de cadenas `cn()` multi-línea | 300 – 500 |
| Resolución de wraps de `className` largas (2,671 atrs >140 chars) | 600 – 1,000 |
| Colapso de divs anidados marcador | 300 – 500 |
| CSS marcador-only + imports | 150 – 250 |
| Nuevos primitivos de form/feedback (extra colapso) | 150 – 300 |
| **Total estimado** | **~1,500 – 2,550 líneas** (~2.3% – 4% del scope) |

Mejora principal es **cualitativa** (densidad de señal en JSX, ~100 KB menos de texto fuente por acortamiento de className).

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Agente "mejora" fuera de scope | Prompt explícito; revisión por PR separado. |
| `Box` crece demasiado en props | Limitar API; valores raros siguen vía `className=`. |
| Pérdida de className de dominio | Passthrough obligatorio; smoke test A4 detecta temprano. |
| CSS regression por orden de clases | Outer HTML diff en A4. |
| Conflictos merge entre agentes | Scopes disjuntos; worktrees opcionales. |
| Re-exports rompen tree-shaking | `primitives/index.ts` usa re-export directo (`export { default as Button } from '...'`); Vite/Rollup hacen tree-shake correcto. |
| Alias `Switch`/`Badge` vs nombres originales | Mantener ambos exports (legacy + alias) durante transición. |

---

## 6. Criterio de "done"

- `volt-container`, `volt-title`, `volt-text` = 0 ocurrencias.
- TypeScript compila, build pasa, rutas smoke idénticas.
- LOC neto JSX baja ≥ 2% en scope.
- Ningún `.css` referencia clases muertas.
- `src/shared/presentation/primitives/` contiene 18 primitivos nuevos + `index.ts` re-exportando los 18 átomos existentes.
- `@/shared/presentation/primitives` es el import canónico en todo el código migrado.
