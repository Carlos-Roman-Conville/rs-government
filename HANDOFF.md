# Government handoff

## State

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
- Validation: 73 targeted tests and all 371 tests pass; checker reports 25 records,
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
- suit-of-mill has no sourced period. Its pre-existing 1215 boundary is retained
  only as fixture coverage, explicitly marked unsourced in the record. A required
  calendar-point from cannot express an unknown date; no replacement date was
  invented. Keeper must source it or specify an unknown-start representation.
- Frankpledge, heriot and merchet predate 1215; their 1215 bounds describe coverage,
  not enactment. Assize/gleaning dates are approximate; forestalling is attested by
  1321. Notes preserve that precision. Additional source work is outside this task.

## Gotchas

- Settled by DESIGN sections 1.1/1.2, 0ab1303: same-authority-only supersession;
  distribution rows per (actor, domain, person); rivals exclude the actor's own
  delegation chain (2890); a jurisdiction id is not a place id (2890).
- from is inclusive; until is exclusive. Year-only bounds normalize to January 1,
  so a repeal year is wholly excluded. status repealed is for an in-run event.
- Winchester hue-and-cry/watch-and-ward: until null, "repealed 19th century, date not
  stated". Null does not establish perpetual validity. Apparel uses England's 1863
  repeal; SOURCES.md's unconfirmed 1364 claim is noted, not used.
- Notes are provenance only, never executable predicates. Merton's empty sanctions
  list invents no remedy; other existing fixture consequence issues remain outside
  this date/Merton repair. DESIGN.md, SOURCES.md and the Settlement contract unchanged.
