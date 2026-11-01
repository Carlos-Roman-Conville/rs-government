# Government handoff

## State

- 2902: data/runtime laws accept `from: null` (no sourced start); loading skips
  conversion of null bounds, and applicability and authority delegation include
  every day before `until`, including negative days. Frankpledge, heriot, merchet
  and suit-of-mill no longer invent a 1215 start; source precision stays in notes.
- 2902: corrected Merton's exclusive repeal bound to 18 December 1953 from 2901's
  SOURCES.md. Removed unsupported fines; Quia Emptores retains the tenure change
  in its consequence note. Labourer hiring/keeping is detention, separate from
  double repayment and treble damages (amounts remain null).
- 2902: `test/laws-sanctions.test.ts` checks all 25 records against only their own
  SOURCES.md Consequence line, using explicit vocabulary equivalents (imprisonment
  for detention, forfeiture for seizure, etc.). Unknown amounts do not erase a
  stated sanction; an unstated penalty cannot acquire one.
- 2902 scope decision: the all-record source invariant also required removing
  fines from forest common/agistment, Winchester hue-and-cry and watch-and-ward,
  preserving their source consequences in notes. Winchester arms keeps its
  condition unchanged, but its unsupported fine was removed: leaving the whole
  record unchanged would contradict the required no-unstated-sanction check.
- 2902 validation: 239 targeted law tests passed before the final loader guard;
  the final gate passed all 444 tests in 14 files, the no-invented-1215 assertion,
  the 25-record checker (zero failures), and `tsc --noEmit`. Diff whitespace clean.
- 2863 (705ce83): executable law schema, predicates, loader and checker.
- 2864 (d04b4dc): applicability, objective breaches and separate violation stages;
  consequences become commands to owners, never writes to another engine.
- 2865 (0e80b37): SOURCES.md documents 25 medieval English rules and source limits.
- 2866 (69186b3): JSON fixture and READS.md. This task (2888) repairs calendar
  dates/repeals and Merton's modality and consequence after the failed review.
- 2867 (3f8fe4f): computed authority from laws, recognition and backing. Subsequent
  work added the no-meter check (67fb4b4) and Settlement provider (2b5f384).
- 2888: all 25 files use calendar points and status in-force. loadLaws(root, toDay)
  validates source dates and converts with the caller's calendar; runtime Law keeps
  numeric days. The CLI uses scripts/calendar.ts, with Julian/Gregorian arithmetic
  and Gregorian 1970-01-01 as its fixed epoch, importing no other engine.
- Merton c.4 is permit, no power, no sanctions; its consequence note records that
  the enclosure stands and tenants may complain by writ. Applicability tests cover
  every fixture in 1300, with seven later source dates explicitly listed by slug.
- 2888 validation: 73 targeted tests and all 371 tests pass; checker reports 25 records,
  zero failures. Final gate assertions and tsc --noEmit pass.

## Next

- Unit 2890: implement the settled delegation-chain rival exclusion and person.place
  lookup in authority calculations. These are implementation work, not open design.
- Hosts must supply toDay using the same epoch as their act days; update external
  callers of the formerly one-argument loader when integrating this change.
- Resolve the historical source gaps below before treating fixture coverage bounds
  as complete historical enactment dates.

## Blocked

- SOURCES.md has no sourced empower rule. Removed the fixture's "one empower"
  assertion; a historical power-conferring fixture needs additional source work.
- Winchester arms wealth condition remains `true`: READS.md has no land-income,
  goods-wealth or arms-inventory read; SOURCES.md omits the middle bands and the
  richest threshold. Comparisons alone cannot supply those facts. Source the
  missing tiers and declare owner reads before encoding the condition.
- Quia Emptores' tenure change has no representation in the current void/sanctions
  consequence union. It is retained in a note with no invented sanction; executing
  that change requires a separately designed owner command. The same limitation
  applies to Winchester's general host/collective liability.
- Assize/gleaning dates are approximate; forestalling is attested by 1321. Gleaning
  and sheaves-payment retain the evidence limitations recorded by 2901; suit of
  mill has no sourced period. No additional historical source work was attempted.

## Gotchas

- Settled by DESIGN sections 1.1/1.2, 0ab1303: same-authority-only supersession;
  distribution rows per (actor, domain, person); rivals exclude the actor's own
  delegation chain (2890); a jurisdiction id is not a place id (2890).
- Non-null from is inclusive; null from has no lower bound. until is exclusive.
  Year-only bounds normalize to January 1,
  so a repeal year is wholly excluded. status repealed is for an in-run event.
- Winchester hue-and-cry/watch-and-ward: until null, "repealed 19th century, date not
  stated". Null does not establish perpetual validity. Apparel uses England's 1863
  repeal; SOURCES.md's unconfirmed 1364 claim is noted, not used.
- Notes are provenance only, never executable predicates or tenure-change commands.
  Empty sanctions invent no remedy. DESIGN.md, SOURCES.md, CHECK.md and the
  Settlement contract were unchanged by 2902.
