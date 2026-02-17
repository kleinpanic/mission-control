# Mission Control CI Improvements — PLAN

**Task**: Fix mission-control CI failures (better-sqlite3 bindings + lint errors)  
**Agent**: dev  
**Started**: 2026-02-16 15:07 EST  
**Duration**: 8h  
**Involvement**: medium

---

## Status
**Current**: Executing  
**Phase**: PHASE 2 - EXECUTE  
**Next**: Execute subtask 2 (reduce lint warnings - ongoing)

---

## Context

**Discovery findings:**
- CI is currently passing (all runs since Feb 16 successful)
- Previous failures (Feb 15) were better-sqlite3 native binding issues
- Fixed with workaround: hardcoded path to pnpm store + npm rebuild
- Lint: 213 warnings (under 300 threshold), mostly `any` types

**Root issues to fix:**
1. Hardcoded version path `better-sqlite3@12.6.2` in ci.yml - brittle, will break on upgrade
2. High lint warning count - reduces to technical debt

---

## Subtasks

### 1. Make better-sqlite3 rebuild version-agnostic
**Status**: [x] Complete — commit 48611be  
**Risk**: Low-medium (CI change, but safer than current hardcoded approach)  
**Actions**:
- Find better-sqlite3 version dynamically in CI
- Use `find` or `pnpm list` to locate the actual pnpm store path
- Update ci.yml with version-agnostic rebuild command
- Test locally with `act` or verify in PR

### 2. Reduce lint warnings (target: <150)
**Status**: [/] In progress (reduced to 186)
**Risk**: Low (code quality, no behavior change)  
**Focus areas** (from lint output):
- [x] Refactor `src/types/index.ts` to use `unknown` instead of `any` (reduced 8 warnings)
- [x] Refactor `src/app/api/agents/route.ts` (reduced 12 warnings)
- [x] Refactor `src/lib/db.ts` (reduced 7 warnings)
- [ ] Refactor other API routes (high concentration of `any`)
- [ ] Fix React hooks exhaustive-deps warnings
- [ ] Fix `setState` in effect warnings (cascading renders)
- [ ] Prioritize: API routes, types/index.ts, components with most warnings

### 3. Verify CI passes with changes
**Status**: [ ] Not started  
**Risk**: Low  
**Actions**:
- Run `pnpm lint` locally (should pass)
- Run `npx tsc --noEmit` locally (should pass)
- Run `pnpm test:run` locally (should pass)
- Push changes and verify GitHub Actions pass

---

## Must-Haves (Definition of Done)
- [ ] CI workflow uses version-agnostic better-sqlite3 rebuild
- [ ] Lint warnings reduced to <150 (from 213)
- [ ] All CI jobs pass (lint, typecheck, test, build)
- [ ] No new errors introduced
- [ ] Changes committed with clear messages

---

## Notes
- CI already passing, so changes are preventive maintenance + quality improvement
- If version-agnostic approach proves complex, may ask Klein about acceptable alternatives
