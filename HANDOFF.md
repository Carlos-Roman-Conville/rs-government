# Government handoff

## State

- Law schema, loader, evaluation stages and computed authority are implemented;
  authority includes delegation-chain rival exclusion and person.place lookup (2890).
- The fixture has 24 records. Broughton is parked; assize and gleaning have no
  sourced start. Gleaning retains the customary right of the poorest, without the
  unsupported age/health list, fine or court procedure. SOURCES.md records limits.
- Sanctions are checked against each record's own source Consequence line.
  Calendar loading preserves source precision and converts through host toDay.

## Next

- 2890 added host read `law.empowered-actors` (data/laws/READS.md): Settlement must
  supply it; GOVERNMENT-SETTLEMENT.md does not list it yet. Reconcile on integration.
- Hosts must supply toDay with the same epoch as act days; update external callers
  of the former one-argument loader. Resolve source gaps below before integration.
- §1.3 Rule creation and amendment.
- §1.4 Compliance and enforcement, including courts and policing.
- §1.5 Institutional succession.
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

- SOURCES.md has no sourced empower rule; a historical power-conferring fixture
  needs additional source work. The former "one empower" assertion stays removed.
- `winchester-1285-arms-assize` wealth condition remains `true`: READS.md has no
  land-income, goods-wealth or arms-inventory read; SOURCES.md omits the middle
  bands and richest threshold. Source the missing tiers and declare owner reads
  before encoding the condition; no new host read was added in this fix.
- Quia Emptores' tenure change has no representation in the void/sanctions union.
  Its note invents no sanction; execution needs a separately designed owner
  command. Winchester's general host/collective liability has the same limitation.
- Assize is placed c. 1266, not exactly dated; gleaning has no sourced period or
  general eligibility threshold, and its issuer/authority are not stated in the
  source. Forestalling is attested by 1321; suit of mill has no sourced period.
  These source gaps remain; no new historical research was attempted.
- `sheaves-payment-bylaw-broughton-1286` is parked: the dead excerpt is the only
  evidence for its provision, date and 4d/12d amounts. Rex must obtain supporting
  text from Ault 1972, *Open-Field Farming in Medieval England*, or a Broughton
  court-roll edition before restoration.

## Gotchas

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
- Notes are provenance, never executable predicates or tenure-change commands.
  Empty sanctions invent no remedy. CHECK.md remains the pre-fix review record.
