# Government handoff

## State

- §1.5: succession laws, direct-child claims and host-recognised command decisions (2937).
- §1.4: 9 sourced procedures, checked law refs and provenance-required deterrence (2936).
- §1.3 enactment records host outcomes, deJure recognition and ineffective amendments (2934).
- Law schema, loader, evaluation stages and computed authority are implemented;
  authority includes delegation-chain rival exclusion and person.place lookup (2890).
- 24 laws; Broughton parked; assize/gleaning lack sourced starts. Gleaning keeps
  the poorest's customary right, without unsourced age/health, fine or procedure.
- Sanctions match source Consequence lines; dates retain precision via host toDay.

## Next

- Settlement must supply `law.empowered-actors` (READS.md, 2890); reconcile the contract.
- Hosts must supply toDay in act-day epoch; update former one-argument loader callers.
- Succession: rotation, tanistry, representation and collateral heirs; open-contest resolution.
- §1.6 Competing jurisdiction.
- §1.7 Censorship and suppression.
- §1.8 Legitimacy as an aggregate of beliefs.
- §1.9 Taxation.
- §1.10 Spending.
- §1.11 Property-rights regimes.
- §1.12 Collective choice procedures.
- §1.13 Military organisation.
- §1.14 Diplomacy, war and polities.
- §3 Demonstration: an institution gaining or losing legitimacy.

## Blocked

- GOV-Q6 custom as issuer awaits agreement with the Society keeper; not implemented.
- SOURCES.md lacks a sourced empower rule; the "one empower" assertion stays removed.
- `winchester-1285-arms-assize` wealth condition remains `true`: READS.md has no
  land-income, goods-wealth or arms-inventory read; SOURCES.md omits the middle
  bands and richest threshold. Source the missing tiers and declare owner reads
  before encoding the condition; no new host read was added in this fix.
- Quia Emptores' tenure change has no representation in the void/sanctions union.
  Its note invents no sanction; execution needs a separately designed owner
  command. Winchester's general host/collective liability has the same limitation.
- Assize is c. 1266, not exactly dated. Gleaning lacks a sourced period, general
  eligibility threshold and issuer/authority. Forestalling is attested by 1321;
  suit of mill lacks a sourced period. No new historical research was attempted.
- `sheaves-payment-bylaw-broughton-1286` stays parked: Rex must source its provision,
  date and 4d/12d amounts from Ault 1972, *Open-Field Farming in Medieval England*,
  or a Broughton court-roll edition; the sole excerpt is dead.

## Gotchas

- Succession host supplies office {id, place}, recognition and per-law appointment/election
  choices ([] = none, null = unknown); maps succession_event to appoint. No preference
  default; no direct heir stays unresolved. Society/Life reads are stubbed in READS.md.
- No stored government type or authority/legitimacy meter. Settlement owns offices,
  permissions and money; Government emits commands and never writes owner state.
- Supersession is same-authority-only. Distribution rows are per (actor, domain,
  person); rivals exclude the actor's own delegation chain. A jurisdiction is not
  a place. Unsourced issuer/authority fields are null (including gleaning): each
  null-authority law has its own unstated:<law id> set, never supersedes or is
  superseded, and gives J = 0. Delegation skips null issuers.
- Non-null from is inclusive; null from has no lower bound. Until is exclusive;
  year-only bounds normalize to January 1. Status repealed is for an in-run event.
- Winchester hue-and-cry/watch-and-ward have null until: repeal century only.
  Null does not prove perpetual validity. Apparel uses England's 1863 repeal;
  the unconfirmed 1364 claim is not a bound.
- Procedure refs accept legacy procedure.*; 6 minimal records use law sources.
- Notes never execute; empty sanctions invent no remedy. CHECK.md is pre-fix.
