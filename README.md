# @rex/government

Government (P8): authority computed from causal conditions (never assigned), law as executable data, compliance and
enforcement, succession, competing jurisdiction, taxation and spending, property-rights regimes, collective choice,
military organisation, diplomacy, legitimacy as an aggregate of Cognition beliefs, polities. A government type is a
label of the computed distribution, read by History from the Catalogue's vocabulary. Design: `DESIGN.md` (approved
by Rex 2026-10-31). Boundary with Settlement: `GOVERNMENT-SETTLEMENT.md`. Rules for belt workers: `codex/RULES.md`,
`cursor/RULES.md`.

## Layout

- `data/laws/`: historical law records (reference data, each with its source)
- `fixtures/manor-1300/`: the first demonstration's world (DESIGN §3)
- `src/`, `test/`, `scripts/`

## Test

```
npm install
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```
