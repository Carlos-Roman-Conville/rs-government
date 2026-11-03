# Government: PLAN.md (Government keeper, 2026-11-02)

**Status (Rex, 2026-11-02): approved as the working design.** This does not lift the build stop or approve unresolved
equations. Rex's rulings the same day:
- Reconcile the interfaces now, by the coordination messages: Settlement (three-valued `may`, funding holds GOV-31),
  Economy (GOV-28), Cognition (C-G3, formation), Society (formation, voting compatibility), Registry (fact / record /
  belief invariant, new records). Agreed contracts are written in here; no further broad Government review.
- **`may = unknown` must be handled explicitly by Settlement:** an unresolved grant never becomes permission through a
  truthy object and is never recorded as a confirmed denial. The institutional operation stays pending or refuses
  *because authority is unresolved*; a separate physical attempt follows GOV-25 (§F).
- **C-G3 released** for a bounded Cognition design proposal: observable inputs, belief-update candidates, assumptions,
  acceptance tests; no equation chosen merely to produce declining legitimacy.
- **GOV-21, GOV-23:** separate missing historical rules from simulation mechanics; propose sourced rules where
  available (GN-7 card); otherwise contests and entitlements stay unresolved. No invented winners, no arbitrary deadlines.
- **GOV-16, GOV-24:** existing defaults kept. **GOV-22:** the source gap stays isolated to the one fixture that needs it
  (`sheaves-payment-bylaw-broughton-1286`, parked outside `data/laws`).

Consolidates `Toolchain/government/DESIGN.md` (approved by Rex 2026-10-31, GOV-Q1–Q8) to `HQ/handoffs/PLAN-SPEC.md`.
Repo `Toolchain/government` at abbdf40. DESIGN.md, GOVERNMENT-SETTLEMENT.md, `data/*/SOURCES.md`, `data/laws/READS.md`
and `data/demo/SENSITIVITY.md` stay as reference; this file is the plan. Government is a **M5** engine: it adds no
mechanism to M1a–M4 and must not touch food, bodies or soil.

## Pass 1 (one page)

**Mechanisms present (code, all pure functions over laws + provider reads):** law schema and predicate language
(`src/law/schema.ts`, `predicate.ts`); evaluation and jurisdiction sets (`law/evaluate.ts`, `jurisdiction.ts`); enactment
under `legislate` (`law/enact.ts`); breach → detection → prosecution → sanction records (`law/violation.ts`); procedures
(`law/procedure.ts`); de jure, recognition, backing, rival, provisional `f` (`authority/distribution.ts:44–231`, `f` at
:182); legitimacy aggregate read (`legitimacy/aggregate.ts`); tax assessment and collection commands (`fiscal/tax.ts`);
appropriations (`fiscal/spending.ts`); property regime / `transferable` (`property/regime.ts`); collective choice
(`choice/collective.ts`); levy and force capacity (`military/force.ts`); polities and treaties (`polity/polity.ts`);
succession incl. english-descent, tanistry, rotation, designation, contested (`succession/*.ts`); legal tender, issue,
retire, mint, refusal breaches (`monetary/*.ts`); censorship → `society.comm_restriction` (`law/suppression.ts`);
`AuthorityProvider.may` port (`ports/authority-provider.ts`), called by Settlement `context.ts:157`.

**Missing:** procedural-fairness and extraction **events** emitted to Cognition (demo emits beliefs via a stub); the
type classifier (Catalogue/History read, not built); diplomacy beyond treaty records; war-state record; aggregate
enforcement estimates `p_detect·p_prosecute·p_capacity` from full runs (structure only, `enforcement/deterrence.ts`);
sanction execution amounts (amercement sizes unsourced). **Track 2, institution formation and change, has no
mechanism at all** (amendments §A). Also missing: three-valued unknowns, case/allegation records, in-world reports
separate from transactions (amendments §B–§C).

**Quantities owned:** law records, violation records and stages, enactment/succession/monetary events, tax
assessments, appropriations, treaty records, comm restrictions. All are **records with invariants** (no balance
equation); Government owns no mass, energy, money or belief. Authority `A`, `R`, `C` and legitimacy are reads, never stored.

**External inputs:** Settlement offices/titles/ledger (built, pinned v0.1.0); Cognition `ought_obey:<domain>` via
`createRecognitionReader` (`cognition/src/ports/recognition.ts:22`, pinned v0.1.0, contract test 931f1ca); Economy
inventories (pinned v0.1.0); act outcomes (IF-43, planned); Life `person.*` and capacity, Society `kin.*`, organisations
(stubbed, `data/laws/READS.md`).

**Outputs:** commands only (Settlement `appoint/vacate/pay/transfer/credit/debit`, Economy inventory `transfer`, host
`mint`); `government.legal_tender`; `may` answers; violation records; observable events for minds.

**Contribution to M1a:** none, by design. Its M1a duty is negative: no Government code debits food or credits a body;
the demo host's consumption stub (`src/demo/legitimacy-harvest.ts:264–268`) is replaced by the M1a loop, not kept.

**The manor demo runs on stubs. Each stub, its replacement, its milestone:**

| Stub (file:line) | Real mechanism (engine) | M |
|---|---|---|
| Yield = Bennett bu/acre × acres × `shockMultiplier` (`legitimacy-harvest.ts:217–220`) | Life plant-growth yield on Reality soil, water, light (M3). Realism `harvest()` (`ecology.ts:201`) is a labelled interim with **no new consumers** (DC-3, INTEGRATION-PLAN M3-06): not wired here | M3 |
| Year-3 shock 0.1 / Campbell 0.61, 0.37, 0.90 | declared weather input to Life's M3 growth (the treatment, labelled) | M3 |
| Need = sampled 36–40 bu/yr (`:196`), daily debit `:266` | realism `householdRequirement` (unit 5425, **queued, not built**) → kcal ÷ kcalPerKg; final: M1a eat loop (Life) | M1a |
| Grain stock = in-repo `balances` map (`:191`, `:234–239`) | Economy inventory; harvest enters by `produce`, levy by `transfer` | M1a / M5 |
| Belief update `min(1, grain/need)` (`test/demo-legitimacy-harvest.test.ts:23`) | `cognition.belief.update` + attribution from events; **labelled stand-in or seeded static until C-G3** | M5 |
| Pay/defy/steal/present callbacks (`:244–245`) | Cognition intention emission (IF-43) | M1a loop, M5 use |
| Backing κ=1, ω=1 (`test:19`) | Life `body.capacity_functional` (κ); Settlement/Economy holdings (ω) | M2 / M5 |
| Sanction execution returns null (`:247–250`) | Settlement `pay`, `transfer` kind seizure; Life injury | M5 |
| Witnessing = direct observation | `cognition.perception.detect` + Society networks | M5 (P6) |
| Granary returns nothing (D-demo-2) | none: GOV-16 open | — |

**Flagged assumptions:** `f = R·C/(C+C_opp)` is level 5 (GOV-Q1); 60 households, 5 acres, zero stores, rent amount,
D-demo-1/2 are modelling choices or level-5 counterfactuals; Campbell figures are second-hand national rounds;
period unit masses (bushel→kg) come from Catalogue and grain kcal/kg from Life (**GOV-26**); member bodies and the
requirement come from Life (5425), household membership from Society (**GOV-27**) (INTEGRATION-PLAN 2026-11-02; Rex
only if those plans find no source). The M1a world is England 1270 with cereals (Rex), the demo's region.

**Confirmed defect (registry data):** `registry/mechanisms.json` marks taxation, spending, succession, property regime,
collective choice, military, polity, diplomacy, suppression and legitimacy aggregate `planned`; all are built (files
above). Status is "implemented", not "integrated" (§6). For the registry keeper.

**Next dependency-ready task (after Rex approves this plan; amended 2026-11-02):** cards GN-1, GN-3 and GN-5, with
the GN-4 execution boundary (CP-1, CP-2: no live engine needed). Then, as before: codex host adapter wiring `createRecognitionReader`
into the demo's `BeliefReader` with a host handle map, beliefs seeded static (update stays the labelled stand-in, C-G3).
Yield waits on Life's M3 plant growth (DC-3); need waits on 5425 and the GOV-26/27 inputs.

---

## Review amendments (Rex, 2026-11-02, from the Government lane review he pasted)

These take precedence over pass 2 where they differ; pass 2's sections point here. Government stays **off M1a's
critical path**.

### A. Two tracks

1. **Institution operation**: a *declared* organisation applies its procedures, assesses, collects and attempts
   enforcement correctly. Most of today's code covers this track (pass 1), fed mostly by supplied configuration.
2. **Institution formation and change**: people create, sustain, contest, corrupt and alter arrangements through
   their own actions. **No current mechanism demonstrates this.** It is an explicit deliverable with its own
   checkpoints (F-1 to F-4), and it depends on Cognition, Society, Economy and Reality/Life. It never follows
   automatically from finishing track 1. Having laws, voting and succession arithmetic is not evidence that varied
   governments will emerge.

Formation is not only custom codification (GOV-Q6). Coordination, coercion, control of an essential resource,
domination and negotiation are all candidate routes. They are hypotheses that the same individual mechanisms must be
able to reach. They are never generators: no government-formation equation, corruption flag or democracy score.

### B. Fact, record, belief (architectural rule for every Government contract)

| Layer | Owner | Example (collector receives 10 coins, delivers 7, reports 7) |
|---|---|---|
| Authoritative transactions | Settlement ledger, Economy inventory, kernel `transfer()` | 10 received; 7 delivered; 3 retained or moved elsewhere |
| In-world record | Government `government.report` (new record): what an official wrote | "collected 7" |
| Beliefs | Cognition | the principal believes 7; a witness suspects more |

- **Physical accounting stays strict.** The simulator's reconciler accounts for all ten coins. Deception is the gap
  between a report and the transactions, never unexplained missing money or matter. An in-world auditor may lack
  information; the conservation checks never do.
- **No in-world actor reads the authoritative layer directly.** Judges, principals and auditors read records,
  observations and testimony. They never read `government.violation` or the true ledger.
- **Visibility.** A journal entry is not common knowledge. Who learns of an act depends on witnesses, location,
  sensory access, communication and later evidence (Cognition's perception boundary). "Concealed" describes an
  *attempt* to hide, not a guarantee. Test: a private payment enters the ledger, and the principal's belief stays
  unchanged until an observation or report reaches them.
- **Documents may be false.** A record's existence, content, provenance and truth are separate. Authentic authorship
  does not make content true (Knowledge tracks access; Cognition interprets).
- **Rules never make prohibited acts physically impossible.** They change opportunities, expectations, detection and
  sanctions. Censorship never deletes a message. Legal tender never forces acceptance. A mint authorisation never
  makes metal. An order to mobilise supplies no soldiers. **GOV-25 decided (Rex, 2026-11-02): see §F.**

### C. Confirmed defects and risks found by the review (checked in code 2026-11-02)

| # | Finding | Evidence | Label | Fix (lane) |
|---|---|---|---|---|
| R1 | "null = unknown" is not honoured: predicates are two-valued; a null read against a string value throws, and null `eq` null is true | `src/law/predicate.ts:63–96` | confirmed defect (repro: `{read:'office.holder', op:'eq', value:'x'}` with read null → throw) | three-valued result `true / false / unknown` with the unknown reads named; "known empty" (`''`, `[]`) separate from unknown (GN-1) |
| R2 | `from: null` is applied as "in force on every earlier day" although it records "no sourced start" | `src/law/evaluate.ts:28–32`; DESIGN §1.1 | confirmed defect (evidence and scenario merged) | separate `fromEvidence: sourced / unsourced` from the scenario's declared applicability assumption; unknown start → unknown applicability unless the scenario declares otherwise (GN-1; supersedes the 2026-10-31 keeper call) |
| R3 | The chain starts from the objective breach; there is no allegation, report, evidence or finding record, so false accusation and wrongful conviction cannot exist | `src/law/violation.ts:4, :18`; procedures are descriptive (`law/procedure.ts`) | confirmed limitation | `government.case` records separate from `government.violation` (GN-3) |
| R4 | `p_s = p_detect·p_prosecute·p_capacity` without conditional meaning or denominators | `src/enforcement/deterrence.ts:32` | risk | `P(S∣B) = P(D∣B)·P(P∣D,B)·P(F∣P,D,B)·P(S∣F,P,D,B)` (F = finding of liability), each with population, period and denominator; zero observations → unresolved, never 0; individual resolution uses actual events (GN-4) |
| R5 | Corporal sanction becomes a direct Life injury request; detention is a host command | `src/law/violation.ts:71–72, :85` | confirmed boundary gap | an order starts a physically resolved enforcement action (restraint, resistance, the action that injures); detention is never only a location write (GN-4, CP-3) |
| R6 | Remission threshold: full proportional tax at the threshold, zero below it, stated only in a comment | `src/fiscal/tax.ts:50, :84` | confirmed (undeclared in the rule data) | boundary rule declared in the law record; D-demo-1 stays an unsourced counterfactual (GN-5) |
| R7 | Obligations are clamped, and overpayment, correction and refund are not represented | `src/fiscal/tax.ts` | risk | `O_remaining = O_assessed − O_remitted − O_confirmed_paid`; explicit overpayment, correction and refund records (GN-5) |
| R8 | Two appropriation calls can each read the same balance | `src/fiscal/spending.ts` | risk | `F_available = B_treasury − F_committed`, commitments as Settlement funding holds, AGREED 2026-11-02 (`hold`/`release`/`settle`; GOV-31) (GN-6) |
| R9 | `f = J·R·C/(C+C_opp)` gives `A = 0` whenever `J = 0`, so it cannot express de facto power | `src/authority/distribution.ts:184` | confirmed structural limitation | report legal authority `J`, recognition `R`, coercive capability, observed compliance and institutional persistence **separately**; `A` stays the GOV-Q1 provisional composite, read by no mechanism; no replacement score is proposed (GN-8) |
| R10 | `shareBelieving` is the mean belief probability, not a share above a threshold | `src/authority/distribution.ts:147` | confirmed naming defect | rename `meanBelief`, and keep coverage (known/missing counts) in every report (GN-8) |
| R11 | Backing sums Life capacities into one number with no task, units or aggregation model | `src/authority/distribution.ts:158`; `military/force.ts:79` | confirmed | capacity is read per declared task with its unit and aggregation model; no general sum until one is defined (GN-8, GN-10) |
| R12 | W2's `units = floor(1000·yield_t)` is stale: after DC-3 the yield arrives in kg | PLAN §4.2 W2 | plan defect | W2 rewritten below to use Economy's own mass contract, with no second conversion |

### D. Ten lanes (each card: question · boundary · model · evidence · functional tests · realism tests · connection test)

| Lane | Question | Boundary | First acceptance case | Connection test |
|---|---|---|---|---|
| GN-1 Laws, jurisdiction, time | Which rules apply to an act, under which authority and version? | Government evaluates; facts come from owners | Two conflicting authorities both stay visible; missing facts are never read as permission or prohibition | Settlement/Life/Society reads through declared ports return tagged unknowns |
| GN-2 Enactment and delegated powers | How do rules change and who is authorised? | Records only; the issuing act is a mind's | A valid enactment changes the applicable set once; an unsupported command acquires no authority automatically | Compatibility with Society's `collectiveChoice` (`society/src/choice.ts:121`, `:229`): the same ballots and procedure give the same result, an empty denominator gives an explicit no-decision, and tie rules match. **Controller ruling DC-16 / SOC-23 (2026-11-02, Rex may override): one voting gear, Society's `collectiveChoice`.** Government's `decide` keeps jurisdiction, eligibility and the act, and calls Society for quorum, threshold and ties. The duplicate arithmetic is removed at M5; until then GN-2 is the equivalence test. **AGREED with Society 2026-11-02:** a declared 'tie → no act' gives a no-act; a procedure silent on ties, or a chair rule with no casting choice, gives `unresolved`, never a no-act (Society PLAN §3 C, §8.5; Society unit when authorised). GN-2 asserts exactly this |
| GN-3 Reports, evidence, adjudication | What is alleged, what evidence reaches whom, what is found? | Judge reads testimony and records, never `government.violation` | A real breach can stay undiscovered; an allegation can be mistaken; a finding can be wrong | Cognition testimony/observation port |
| GN-4 Enforcement and sanction execution | What is ordered, attempted and confirmed? | Owners execute and confirm; physical outcome is Reality/Life's | A fine or seizure is not marked executed until its owner confirms | Settlement `pay`/`transfer` confirmations; Reality/Life action outcome |
| GN-5 Tax assessment and collection | What is owed, by when, what is received, remitted, in arrears? | Assessment is Government's; payment is the payer's act; the move is the owner's | Partial payment leaves a traceable outstanding amount with no duplicate debit | Economy/Settlement transfer confirmation |
| GN-6 Appropriations and spending | What is authorised, committed and paid? | Settlement owns balances and holds | Two appropriations cannot spend the same funds | Settlement funding hold (GOV-31) |
| GN-7 Property entitlement and succession | Who is entitled under which rule, who claims, who holds the office? | Entitlement ≠ title ≠ inventory ≠ possession (Society agreement H6) | A recognised heir, an appointed office holder and the physical possessor stay distinct | Injected death/vacancy event (no wait on Life's mortality); `society.kinship`, `society.claim` |
| GN-8 Recognition, legitimacy, authority summaries | What do the derived views report? | Reads only; never change a mind | Missing beliefs stay missing; no aggregate changes anyone's belief | Cognition recognition reader |
| GN-9 Monetary and communication rules | What do tender, issue and restriction laws declare? | Declarations only | A legal requirement creates no coin and makes no speech impossible | Economy mint transfer; Society/Cognition read restrictions as costs |
| GN-10 Forces, treaties, political relations | What obligations, commands, treaties and declared conflict states exist? | Records; fighting is Reality/Life's | An order to mobilise or fight supplies no soldiers, equipment or victory | GOV-Q7 battle aggregation interface |

Realism tests per card: GN-1 against the 24 sourced fixtures (V-L1); GN-3 against sourced procedures (presentment,
Maitland); GN-5 against Bennett's fixed tallage case; GN-7 against Blackstone's canons and the succession sources;
others as §7. Models and evidence per card are §3 and §5 as amended here.

**First keeper cards (written first, after approval): GN-1, GN-3, GN-5, with GN-4's execution boundary specified
alongside.**

- **GN-1 model.** `B_l(a) = InForce_l ∧ InScope_l(a) ∧ Regulated_l(a) ∧ Condition_l(a) ∧ ¬Exception_l(a)` in
  three-valued (Kleene) logic: `false` dominates `∧`, `true` dominates `∨`, otherwise `unknown`, carrying the unknown
  reads. Output: breach / no breach / unknown(reads). This is a breach under the encoded rule and the supplied facts;
  it says nothing about what anyone knows. Tests: enactment and repeal boundaries; unknown exception → unknown;
  missing jurisdiction fact → unknown; conflicting authorities → two sets; `from` unsourced → unknown applicability.
- **GN-3 model.** Records: `report` (who alleges what, when, to whom), `evidence` (an item and who holds it),
  `finding` (the institution's conclusion under a declared decision procedure from the evidence presented), `order`.
  These may disagree with each other and with `government.violation`. First test: supplied testimony and a declared
  procedure (presentment by jurors), with no courtroom psychology. An innocent person can be found liable; a guilty
  one can be acquitted.
- **GN-5 model.** `T = b` (fixed) or `T = r·X` (proportional, `r` dimensionless, `X` the base read), remission with a
  declared boundary rule. Obligation ledger as R7. Tests: duplicate collection requests collect once; partial payment
  reduces the obligation once; a failed transfer is not a receipt; deadlines and assessment dates are explicit;
  inability to pay is emitted as the observable fact (payer had less than owed), never as "defied", so Cognition is
  not told it was deliberate. Preserve today's split between payment choice and confirmed receipt, and missing
  outcome = unknown.
- **GN-4 boundary.** Order → attempt → owner confirmation. Status `executed` only on the owner's confirmation; a
  refusal or a physical failure is recorded with its reason; no order bypasses restraint or resistance.

### E. Checkpoints

| CP | Scope | Needs |
|---|---|---|
| CP-1 Rules and records | GN-1, GN-2: supplied cases, explicit unknowns, versioned rules | nothing live |
| CP-2 Cases and fiscal execution | GN-3, GN-5 (+GN-4 boundary): reports, a bounded adjudication procedure, assessment, payment, obligations, rollback | owner confirmation ports (Settlement, Economy) |
| CP-3 Physical enforcement | one enforcement attempt with resistance or failure and a confirmed outcome | Reality/Life action resolution |
| CP-4 Succession and institutional interfaces | GN-6, GN-7, GN-9, GN-10; Society procedures; spending; monetary and communication contracts | Society H6, Settlement holds |
| CP-5 Integrated political scenario | the manor stand-ins replaced by the live world (W1–W7); observable outcomes with no required legitimacy fall or rebellion | M1a–M3, C-G3 |

Formation track (deferred; own checkpoints; not an M1a prerequisite):

| F | Scope | Bar |
|---|---|---|
| F-1 | Three people, one contested resource, **no office**. The physical outcome needs coordinated action, meaning uncoordinated individually sensible acts do worse. One person deciding is **not** built in as the answer: negotiation, turn-taking, a shared procedure, delegation, coercion and refusal are all open | Formation, non-formation and breakdown are all reachable across seeds and endowments. If every run produces a coordinator, the test is scripted and fails |
| F-2 | Misconduct: the collector chain (assessment → private demand → payer pays, refuses or reports → recorded vs actual collection → discovery or not) | Report ≠ transaction ≠ belief, with strict accounting (§B); unauthorised acts per §F |
| F-3 | Pressure: coordinated withholding, threats, press restriction met by compliance, resistance or concealment | No automatic deletion; officials' decisions change only through perception |
| F-4 | Institutional change: defections, amendments, succession disputes, competing organisations | Persistence and dissolution both reachable |

Endowments (holdings, debts) and prior history are **experimental variables**. "One holds the well → oligarchy" is a
hypothesis to test, never encoded. Variety must come from working mechanisms for proposing, recognising, resisting and
revising arrangements; distribution alone guarantees nothing.
Dependencies: Cognition (proposals, communication, belief revision, decisions under uncertainty), Society
(organisation and claim records, coalition formation), Economy (resources), Reality/Life (physical outcomes). The
formation experiment is designed with those keepers; Government records the institutional state it produces.
### F. Abuse of office: GOV-25 ruling (Rex, 2026-11-02)

Rex: "Yes, allow it". Lack of authority must not automatically prevent an attempt, and it must not guarantee success
either. Permission and actual ability are different things. Three separate checks, never merged:

1. **Authorisation** (Government): `may(office, power, subject, day)` answers only whether a grant exists: yes, no,
   or unknown (three-valued, R1). It is a read. It no longer stands for "the act cannot happen".
2. **Execution** (owners and Reality/Life): an unauthorised act may be **attempted**. Whether it succeeds depends on
   access, custody, cooperation, resistance and physical capability. Missing authority bypasses none of these, and
   holding authority guarantees none of them: an authorised collector can fail because people resist; an
   unauthorised one can physically take grain, but must still get it.
3. **Legal consequence** (Government, GN-1): a breach is recorded only where an applicable rule is violated. An
   unknown grant or missing legal information leaves the breach **unresolved**, never a breach and never lawful.
   Detection, adjudication (GN-3) and enforcement (GN-4) follow separately.

- **Institutional effect is separate from the act.** A purported official act can lack institutional effect.
  Someone may announce an appointment without changing the recognised office holder: the announcement is a
  `government.report` and an observable event; Settlement's `holder` changes only by an `appoint` that Settlement
  accepts.
- **Real institutional checks stay.** A custodian may refuse: a treasury clerk refusing an unauthorised payment is
  that office holder's act at Settlement's command boundary. Settlement keeps its office-power refusals
  (`context.ts:157`, GOV-8 unchanged), because the ledger's custodian is that check. Corruption then needs a **causal
  route** (deception, cooperation, coercion or another supported action that gets the custodian or the goods), never
  a switch that disables every safeguard.
- **Contract consequence.** Acts outside Settlement's command boundary (taking goods, detaining, striking) never pass
  through `may`. The actor attempts them, Reality/Life/Economy resolve them physically, and GN-1 evaluates them.
  Commands at the boundary keep the custodian's check. Tests (GN-1/GN-4): an unauthorised take that succeeds
  physically → breach recorded, goods moved once; an authorised levy resisted → no transfer, attempt recorded; an
  unknown grant → unresolved; an announced appointment with no accepted `appoint` → holder unchanged; a refused
  unauthorised payment → no ledger change, refusal recorded with its reason.

---

## Pass 2: the full plan

Conventions. Evidence labels per PLAN-SPEC: **measured / calibrated estimate / assumption / fiction**, with PLATFORM §4
level in brackets. `null` = unknown, never 0 (DESIGN preamble). "Read" = computed on demand from another owner's state,
never stored. Sections cited are DESIGN.md unless named otherwise.

### §1 Purpose and boundaries

**Determines:** which rules exist and are in force (laws as executable data, §1.1, §1.3); whether an act breached one
(an objective record that exists whether known or not); the stage a breach reached (detected, prosecuted, sanctioned,
dropped, failed); what is owed in tax and appropriated in spending; who succeeds to an office, or that the succession
is open or unresolved; whether a title command is lawful; which authorities' laws cover an act (all of them, no
winner, §1.6); what an office may do (`AuthorityProvider.may`); legal tender, issue, retire, mint; the authority
distribution `A(k,d)` and the legitimacy aggregate, both as **reads**.

**Receives:** offices, titles, leases, permissions, ledger (Settlement); `ought_obey:<domain>` beliefs (Cognition);
inventories and goods (Economy); act attempts and outcomes (Cognition intention + Reality/Life outcome, IF-43); person
and kin facts (Life, Society); organisations (Society); calendar conversion (host `toDay`, Catalogue `dates.ts`).

**Never calculates (owned elsewhere):** whether anyone attempts, obeys, reports, enforces, votes or declares war
(Cognition); whether an act succeeds (Reality, Life); any belief, legitimacy included (Cognition); yield, need,
consumption, nutrition, capacity (Reality, Life); prices and production (Economy); office holders and balances
(Settlement); organisations, norms, kinship (Society); the label "monarchy" (Catalogue vocabulary, History record);
battle physics (Reality, GOV-Q7). §1.15 stands: no type, legitimacy, stability, rebellion or corruption meter.

**Boundary invariant (tested):** a law changes no number in another engine; every effect is a command to the owner;
with Government absent Settlement's thirty-day run is byte-identical (GOV-8 item 4).

### §2 State

Government owns records, not physical quantities. None has a balance equation; each has an invariant and an update
rule (PLAN-SPEC "conservation is specific").

| Quantity | Unit / type | Valid range | Meaning | Invariant / update |
|---|---|---|---|---|
| `government.law` | record (`src/law/schema.ts`) | schema-valid; kernel days, `from: null` = no sourced start; status in-force / suspended / repealed | an institutional rule: issuer, jurisdiction, regulated act, condition, exceptions, consequence, enforcer, procedure, sources | created only by an enactment event; status changes only by event; superseded only by the same authority |
| `government.violation` | record (`law/violation.ts:4`) | stage ∈ breach, detected, prosecuted, sanctioned, dropped, failed | one breach of one law by one act | stages only advance; `known_to` grows only from an enforcer's observation or testimony |
| `government.procedure` | record (`law/procedure.ts`) | schema-valid, nulls where unsourced | adjudication: judge, proof, appeal | setup data |
| `government.succession_event` | event | claimant ∈ claimant set | appointment, vacancy, open contest, unresolved with reason | one per resolution |
| `government.tax_assessment` | record (`fiscal/tax.ts:53`) | owed ≥ 0 in the base's unit, or `null` (base unknown) | what a payer owes under a tax law on a day | recomputed on the schedule, never edited |
| `government.appropriation` | record (`fiscal/spending.ts`) | Σ allocated ≤ treasury balance read | what a spending law promised and what the balance allowed | enactment (host array) order |
| `government.case` (planned, GN-3) | records: report, evidence, finding, order | each may disagree with `government.violation` and with each other | what is alleged, held as evidence, concluded and ordered | append-only; a finding reads only evidence presented, never the objective breach |
| `government.report` (planned, §B) | record | an official's written claim, possibly false | the in-world record of an act or collection | never reconciled away; the gap to the transactions is the deception |
| tax obligation (planned, GN-5) | the base's unit | `O_remaining = O_assessed − O_remitted − O_confirmed_paid`; overpayment, correction and refund are explicit records | what is still owed | changes only by a confirmed receipt, remission or correction |
| funding commitment (planned, GN-6) | money | Σ committed ≤ treasury balance | an appropriation's claim on funds | a Settlement hold (GOV-31) |
| `government.entitlement` | record (planned, 3.8) | heir-at-law person id(s), or `unresolved` with reason | who is entitled under law to a holding; never who receives | written once per death; separate from Society's custom record |
| `government.treaty` | law record over two authorities | — | treaty, truce, tribute, marriage | as `government.law` |
| `government.monetary` event | event | — | issue, retire, mint, refusal with reason | one per command |
| `society.comm_restriction` (Government writes) | record | — | who may send what by which medium where | per suppression law |
| `government.legal_tender` | read, string[] | sorted, de-duplicated | assets that must be accepted for a purpose | never stored |
| `A(k,d,i)`, `J`, `R`, `C`, `C_opp` | dimensionless; `J` ∈ {0,1}; `R` ∈ [0,1] or null; `C`, `C_opp` ≥ 0 | — | authority distribution (§1.2) | never stored, never an input to itself (GOV-Q1) |
| legitimacy `R`, `shareBelieving` | [0,1] or null | null beliefs excluded | aggregate of Cognition beliefs | read (`legitimacy/aggregate.ts:22`) |

Physical quantities Government touches **by command only**: grain (kg, an Economy good), coin (Settlement ledger),
office holders (Settlement). It keeps no copy of any.

### §3 Mechanisms

Each: input source → computation → output and what it changes. Detail stays in the DESIGN section cited.

**3.1 Law evaluation** (`government.law.schema`, §1.1). Act `{actor, action, object, place, day, attempted, succeeded}`
(host, from Cognition intention + Reality/Life outcome) → `applicableLaws` filters in-force laws by jurisdiction
(authority, places, persons predicate, `from` / `until`), `regulated` match, `condition` true, no `exception` true
(`law/evaluate.ts`) → `Breach[]` → `createViolation` (stage `breach`). Predicates are a closed language over declared
reads (`law/predicate.ts`); a missing read throws, `null` is unknown. Assumption: law is crisp; open texture goes to a
judge's mind (GOV-Q5). Stops applying: an act no law covers is lawful (no default prohibition).

**3.2 Rule creation** (`government.rule.creation_amendment`, §1.3). Draft + issuer + body outcome (3.10) →
`deJure(…, 'legislate', …, draft.regulated.action)` → a law, or failure `not-quorate | unresolved | not-adopted`
(`law/enact.ts`). A usurper's decree is still recorded with its issuer. Customary law only through a recognition
event (GOV-Q6). Changes: the law set.

**3.3 Breach chain** (`government.compliance.enforcement`, §1.4). Violation → **detected** when an enforcer's mind
holds an observation or testimony (Cognition `perception.detect` via `ObservationReader`, planned) → **prosecuted** when
the enforcer mind chooses, under the procedure → `sanctionCommands` (`law/violation.ts:76`) to owners (Settlement
`pay`, `transfer` kind seizure; Life injury; host detention) → **sanctioned** only when the owner confirms execution (GN-4); resistance
outcome from Reality/Life → **failed**. Aggregate resolution: `p_s = p_detect · p_prosecute · p_capacity`
(`enforcement/deterrence.ts:32`), each factor carrying its provenance and **estimated from full-resolution runs or a
source**, never set; using `p_s` in a decision stays Cognition's (through Society's aggregation). Evidence: Nagin 2013
[2]; Becker 1968 as structure [4].

**3.4 Authority** (`government.authority.acquisition_delegation`, §1.2). `J(k,d,i)` from in-force `empower` laws and
`delegationChain` (`authority/distribution.ts:44, :104`); `R(k,d) = Σ ω_i b_i / Σ ω_i` over persons with known `b_i`
(`:124–131`), `b_i` from Cognition, `ω_i` from Settlement / Economy / Society holdings; `C(k) = Σ κ_j y_j` over k's
agents (`:151`), `κ_j` Life capacity, `y_j` the agent's own `b_j`; `C_opp` = largest backing among rivals off k's
delegation chain (`:164–178`); `A = f(J,R,C,C_opp)`, `f = J·R·C/(C+C_opp)` tagged `provisional-v1` (`:182`),
swappable. Assumption [5] (GOV-Q1). Changes nothing; consumers read it. `R` null for everyone → `A` null, not 0. **Amended (R9–R11):** `J = 0` forces
`A = 0`, so `A` is not de facto power. Reports carry `J`, `R`, coercive capability (per declared task, R11),
observed compliance and persistence separately; no mechanism reads `A`.

**3.5 Legitimacy aggregate** (`government.legitimacy.aggregate`, §1.8). Cognition beliefs → `legitimacyRead`
(`R`, `shareBelieving` (to be renamed `meanBelief`, R10), `populationSize`, coverage). Government **makes experiences observable** as events (assessment against
what is left, sanctions seen, relief promised and paid, others' compliance); the update of `b_i` from them is
Cognition's. **C-G3 proposal (Cognition PLAN A.12, 2026-11-02; supersedes C-G3-DESIGN §3, §5).** Each event goes only to
those who perceive it. Five grounds are held as separate Beta beliefs: G1 procedure (Tyler), G2 promise kept (Levi), G3
subsistence left (Scott), G4 others comply (Levi; Fischbacher, Gächter & Fehr), G5 breaches enforced (Levi). They
combine into `ought_obey:<domain>` as a declared weighted mean. A product was rejected because it builds decline
into the structure. The port is unchanged. Two new beliefs: `can_enforce:<domain>`, a belief *about* capability that is
never Government's coercive-capability read (R9), and `others_comply:<domain>`. Tests check the mechanism only; the
manor A/B directions are predictions registered before the run, then reported. Open for Rex (Cognition's items):
C-G3a weights and priors, C-G3b keyed by office or holder, C-G3c whether inability counts in G4, C-G3d whether G4
enters `ought_obey`. Until built: a labelled stand-in, or beliefs seeded static.

**3.6 Taxation** (`government.fiscal.taxation`, §1.9, DUP-42). Tax law (persons, base read, schedule, collector,
treasury) + base read (`economy.harvest` port today; Economy inventory or Settlement title later) → `assess` (owed or
null) → the payer's choice (Cognition) → `collectionCommands` (`fiscal/tax.ts:116`: Economy `moveStock` payer →
treasury inventory, or Settlement `pay`), only if `may(collector, 'levy', payer, day)` → `taxBreaches` (`:136`) on
unpaid. Runs in Government's own phase; `publicWorks()` stays a no-op. The owner's command is the payment's only debit
and credit.

**3.7 Spending** (§1.10). Treasury balance read + spending laws in host order → appropriations within the balance →
Settlement `pay`; an unpaid appropriation is recorded (evidence for beliefs).

**3.8 Property regime** (§1.11). Title command + laws on it → `titleCommandLawful` / `transferable`
(`property/regime.ts`): `null` when no law speaks (Settlement's field stands), else lawful or `void`.
**Entitlement under law of a holding (agreed with Society 2026-11-02, Society PLAN H6; follows Rex's SOC-R4):** at
a holder's death the regime runs the Blackstone canons (the same algorithm as 3.11, one gear) reading `society.kinship`
and writes a `government.entitlement` record naming the **heir at law**, the person entitled, not the person who
receives. It executes nothing. A transfer happens only on a command, after a claim act (`society.claim`) and, where
there is one, adjudication (3.3); Settlement and Economy execute it, and nothing transfers at a death. Society keeps its
own entitlement-under-custom record, which is never merged with this one. Precedence (SOC-Q3, Rex: law where enforced,
custom otherwise) is never computed in advance. 3.9 lists every applicable set, and "enforced" is read afterwards
from violations that reached `sanctioned`. Status: designed; the regime caller is not built (the canons today run
only inside succession, keyed by office id, `succession.ts:117, :299–303`).

**3.9 Jurisdiction and censorship** (§1.6, §1.7). Every applicable law set with its authority, no winner; communication
laws → `society.comm_restriction` commands (`law/suppression.ts`).

**3.10 Collective choice** (§1.12; DC-16: the arithmetic is Society's `collectiveChoice`, and Government keeps jurisdiction, eligibility and the act; the duplicate is removed at M5). Members' ballots (Cognition) + procedure → `decide` (quorum, threshold, tie rule;
`unresolved` when the tie rule or chair choice is missing; `choice/collective.ts`). Level 1 as arithmetic.

**3.11 Succession** (`government.succession.institutional`, §1.5). Holder's exit (Life death, Settlement vacate, end
of term) + the office's succession law + kin and person reads → `successionClaimants` (primogeniture, appointment,
election, english-descent with the 5079 half-blood exclusion, tanistry, rotation, designation) → `resolveSuccession`:
one claimant → Settlement `appoint`; several → `settleContest` when `contest` is present (arbitration, treaty,
force), else `contested`; open emits nothing; regency via `office.regent`; escheat → `vacate`; every unknown →
`unresolved` naming the read. Offices only (Society agreement 2026-11-02): `english-descent` applies to an office
only when that office's own law says it descends as land (a hereditary office, a manor); household inheritance is
3.8's. Open: GOV-21 (i)–(iv) and per-rule rates, GOV-23 (a)(b); `contest.victor` waits on the
GOV-Q7 Reality interface.

**3.12 Military** (§1.13). Levy laws → `levyObligations` / `levyBreaches`; `forceCapacity` reads persons (Life),
equipment and supply (Economy), loyalty `y_j`; `chainOfCommand` is the connected delegation set, not rank
(`military/force.ts`). No force register (Society organisation, GOV-6). Battle aggregation: shared interface, not built.

**3.13 Polity and diplomacy** (§1.14). `polities`: apexes of empower chains; territory per (jurisdiction, place, domain,
person) winner of `A`; a place may sit in two polities (`polity/polity.ts`). Formation and collapse are graph changes,
never events. `treaties`: two-authority law records. War decisions are Cognition's (through 3.10 for a body); Government
supplies the power, forces, revenues, obligations and the legal state of war (**war-state record not built**).

**3.14 Monetary** (§1.16). Legal tender read; issue/retire → one Settlement `credit`/`debit` when `may`; mint → host
command resolved as one Economy transfer, metal content read from the coin good; a refusal whose purpose is in tender →
breach (3.3).

**3.15 Manor demonstration** (§3, GOV-Q8). Composition of 3.1, 3.3–3.6 on one manor c.1300: harvest → assessment
(variant A fixed rent; B proportional with remission, D-demo-1) → payment → breaches → presentment
(`procedure.manorial-court-presentment-by-jurors-or-homage`) → sanctions → observable events → belief change → `R`, `C`
read daily. Built on stubs (`src/demo/legitimacy-harvest.ts`, `test/demo-*.test.ts`); the stub map is in pass 1; the
wiring contracts are §4.2.

### §4 Inputs and outputs

#### 4.1 Standing ports (built or agreed)

| Quantity | Producer → consumer | Unit / range | Timing | Failure / rollback |
|---|---|---|---|---|
| `may(office, power, subject, day)` | Government → Settlement (`settlement/src/context.ts:157`) | **AGREED 2026-11-02:** `{yes} \| {no, reason} \| {unknown, reads}`; unknown → `officeHas` throws `authority unresolved: <reads>`, no row written, no denial recorded, host retries (staged: `HQ/handoffs/government/GOVERNMENT-SETTLEMENT-section-may-holds.md`) | command time (`commands.ts:182, 216, 632, 646`) | Government absent: default reads `Office.powers[]`, run byte-identical (GOV-8) |
| offices, titles, leases, permissions, accounts | Settlement → Government | records | on read | missing → throw; vacancy `''` |
| ledger `pay`, `credit`, `debit`; balance | Government → Settlement (command); balance read | money, currency-tagged | Government's phase | refusal recorded, no retry; the ledger is money's one home |
| `ought_obey:<domain>` | Cognition → Government (`createRecognitionReader`) | P(true) ∈ [0,1] or null | on read, daily | no belief or no handle → null, excluded |
| inventory `moveStock` (levy, tribute) | Government → Economy (command) | good units, finite ≥ 0 | assessment deadline | Economy throws beyond stock → paid = moved → breach on the rest |
| `government.legal_tender` | Government → Economy / host | string[] | on read | none → `[]` |
| `Refused` with `purpose` | Economy → Government | record | event | no purpose → no breach (GOV-19) |
| act outcome (IF-43) | host (Cognition + Reality/Life) → Government | `Act` | event | missing field → throw |
| `kin.*`, `person.*`, `office.*`, `estate.*` | Society, Life, Settlement (stubbed, `data/laws/READS.md`) | per READS.md | on read | null → `unresolved` naming the read |
| kg per bushel (Catalogue period unit masses); grain kcal/kg (Life) — GOV-26 | Catalogue, Life → Government demo host | kg/bu > 0; kcal/kg > 0, with basis | setup (static per run) | missing → the W1/W3 adapter refuses to run, no fallback; to Rex only if Catalogue finds no source |
| member bodies and requirement (Life, 5425); household membership (Society) — GOV-27 | Life, Society → demo host | bodies per realism; schedule Σ = 86 400 s | setup; schedules daily once time use exists | null member → household need null, reported; to Rex only if Life/Society find no source |
| `society.kinship` | Society → Government (read only, never written) | kin records | on read | null → `unresolved` naming the read |
| `society.claim` | Society (a person's or organisation's own claim act) → Government | record | event | no claim → no transfer command |
| `government.entitlement` (heir at law of a holding) | Government → Society, Cognition, History (read) | record | at a holder's death | unresolved with reason; never executes a transfer |
| custom ids `custom:<holder>:heriot`, `:merchet`, `:free-bench`, `:descent` | Society norms (PLAN §3 S, not built) → cited by Government law records | id | static | cited by id until Society builds them; holder = the manor's community id |
| `appoint`, `vacate`, `transfer` seizure | Government → Settlement | command | on resolution | refusal recorded; violation → `failed` |
| `society.comm_restriction` | Government → Society / Cognition | record | on enactment | — |
| observable events (assessment, sanction, relief, succession open/settled) | Government → host → Cognition perception | event | when they happen | Cognition decides what is perceived and attributed |

#### 4.2 Manor demonstration wiring contracts

Grain moves once per flow: **Life** (M3 plant growth) decides harvest mass, **Economy** credits it to the household inventory once,
the levy is one Economy `moveStock`, consumption is one **Life** eat debit (M1a). Government debits and credits nothing.

**W1. Yield: Life plant growth (M3)** (controller ruling DC-3, 2026-11-02, INTEGRATION-PLAN M3-06; Rex may override).
Realism `harvest()` (`ecology.ts:201`) stays a labelled interim with no new consumers, so the demo does **not** wire it;
M5 follows M3 and the demo reads Life's yield directly. Contract Government needs from Life's M3 output (exact field
names to take from Life's PLAN when reconciled):
- per household holding and harvest day: grain mass of the harvested part, kg (dry-grain basis stated), ≥ 0, with
  the crop and the trace id of the growth run; soil removal is debited inside Reality/Life once, never by the host.
- the year-3 treatment is a **declared weather input** to that growth (labelled as the experiment's treatment), not a
  yield multiplier. Campbell's 1315–17 all-cause indices (0.61 / 0.37 / 0.90, `harvest-loss-1315`) become a
  **validation target** for the deprived run (V-D6), never an input applied on top of Life's yield. The 0.1 baseline
  is retired with the stubs.
- Bennett's 8–9 bu/acre (`grain-yield`) is likewise a validation target for normal years (V-D6), converted with
  Catalogue's kg per bushel (GOV-26); nothing is calibrated to it.
- labour enters through Life/Cognition work at M2, not a `labourFactor` set here.
- Failure: no yield record for a holding on a harvest day → the day's assessment for it is `null` (base unknown, 3.6),
  never a default.
Until M3: the demo keeps its labelled stub; the `maxYield = Y_normal/(0.3+0.7 f₀)` calibration drafted earlier is
withdrawn (it would make the interim a consumer).

**W2. Stock: Economy (AGREED with the Economy keeper 2026-11-02, GOV-28; Economy PLAN EN-7, EN-8).**
- **Credit:** one kernel transfer. Its debit is Life's harvested-yield account (Life owns it). Its credit is the
  economy.goods kg view `<household inventory>/<grain>`, process `life.harvest`, carrying Life's trace id. Receipt =
  Life's taken kg exactly. Never `addStock`, which carries no cause, counts units and credits from nowhere (ECON-32).
  The interim until EN-7 is built is `addMass` (kg, with CommandCause). The grain good weighs 1 kg/unit, so there is
  no rounding residue; Σ is checked in kg. Economy's abstract production (productionPerDay or a grain recipe) is off
  for that inventory and good; the configuration check refuses a scenario that has both.
- **Levy:** `stockOf` and `moveStock(household → treasury inventory, grain, kg)` run in one host transaction, moved =
  min(owed, stock), only when the collector's grant is "yes" (§F). `moveStock` has no cause field yet, so the trace
  link sits in Government's record until one is added. The shortfall is Government's obligation (GN-5, R7); Economy
  records no debt (ECON-26 untouched).
- **Consumption** is Life's eat debit (M1a). **Spoilage** of stored grain is Economy EN-8, charged once. Seed
  retention stays ECON-5 (Rex). The fixture's tax unit changes from bushel to kg once, using Catalogue's factor (GOV-26).

**W3. Need: Reality/Life `householdRequirement`** (unit 5425, **queued, not built**).
`energyRequirement(body, schedule, {food, meal}) → { absorbedKcal, foodKcal, basis, omitted }` per person-day;
`householdRequirement(members)` sums, null if any member is null (listing them).
Grain need per household-day `= foodKcal_household / kcalPerKg(grain)` kg; per year × the host year length.
- `members`: bodies (height, age, sex) and an 86 400 s MET schedule each — **consumed inputs (GOV-27)**: bodies and
  the requirement from Life (5425), household membership from Society, day schedules from Life/Cognition time use. Bennett's five or six persons (`household-subsistence`) is the cross-check on composition,
  not the producer. Government computes none of them.
- `kcalPerKg`: **consumed input from Life (GOV-26)** for the period grain (England 1270 cereals); kg per bushel, to
  express need and levy in the sources' unit, from Catalogue's period unit masses. `basis` goes into the trace; `omitted` (growth,
  thermoregulation, pregnancy, lactation) is reported: the need is a floor.
- **Independent check, not calibration:** the annual need in bushels is compared with Bennett's 36–40 (V-D3); bodies
  are never adjusted to hit it.
- Consumption is **not** this read: the host's daily debit (`legitimacy-harvest.ts:264–268`) is removed at M1a, when
  each member's eat decision debits the inventory once and Life credits the body once.

**W4. Beliefs: Cognition.** `createRecognitionReader({ beliefs(person), handle(person, actor) })` →
`recognition(person, actor, domain)` (`cognition/src/ports/recognition.ts:22`) is Government's `BeliefReader` for
`legitimacyRead` and `backing`. The host supplies the handle map (court and beadle ids → each mind's handle). Beliefs
are categorical `ought_obey:levy` holding `"true"`, seeded at day 0 (value: labelled assumption). **Update:** none
exists (C-G3). Two allowed modes, both labelled: (a) static seeded beliefs, with §3 item 1 "beliefs fall" reported as
not represented; (b) today's stand-in `min(1, grain / need)` kept as a host stand-in that writes through Cognition's own
belief API, every trace row marked `stand-in (C-G3)`. Government never writes a belief. The real update is Cognition's C-G3 proposal (§3.5); Government's duty is the
eight events, each with the facts only (an inability event carries owed, paid and holdings, never an intent label;
an official's report is delivered as testimony).

**W5. Decisions.** Pay / defy / steal / present → Cognition intention emission (IF-43) from each household and enforcer
mind; until then the host callbacks stay labelled (expected-consequence payment, C-G2, GOV-9).

**W6. Backing and weights.** `κ_j` = Life `body.capacity_functional` (M2); `ω_i` = Settlement holdings / Economy goods;
1 until then, labelled.

**W7. Sanctions.** Fine → Settlement `pay` of the amercement the law's consequence states; seizure → Settlement
`transfer` kind seizure of a named title. No source gives this manor's amercements or seizure targets, so execution
stays `null` with its reason (as built) until one is found.

**Fact, record, belief (amendments §B):** every adapter keeps the authoritative transactions, the official's report
and minds' beliefs as three things; no mind reads the first.

Order within a day: harvest (W1) → credit (W2) → assess (3.6) → payment decisions (W5) → levy (W2) → breaches →
presentment and sanction (3.3, W7) → events → beliefs (W4) → reads `R`, `C` → eat (M1a, W3). Rollback: an owner
command that throws aborts that day's Government phase and discards its records; no partial phase is committed.

### §5 Evidence

| Item | Source | Label [level] |
|---|---|---|
| Law schema (primary/secondary rules, powers) | Hart 1961; Hohfeld 1913 | assumption as model of real law [3] |
| Evaluator, predicates, collective-choice arithmetic | logic; Arrow 1951; May 1952 | measured, exact [1] |
| 24 historical law fixtures | `data/laws/SOURCES.md` (statutes 1217–1363, manorial customs) | measured [3]; `from: null` where unsourced |
| De jure vs de facto power | Acemoglu & Robinson 2006 | assumption [3] |
| Selectorate weighting | Bueno de Mesquita et al. 2003 | assumption [3–4] |
| `f = R·C/(C+C_opp)` | none (GOV-Q1) | assumption [5], provisional |
| What legitimacy beliefs rest on | Weber 1922; Scott 1976; Thompson 1971; Levi 1988, 1997; Tyler 1990, 2006 | assumption [2–3], for Cognition's update (C-G3) |
| Deterrence by certainty | Nagin 2013 | measured direction [2] |
| Legal pluralism | Benton 2002; Berman 1983 | [3] |
| Censorship target | King, Pan & Roberts 2013 | [2] |
| Succession rules | `data/succession/SOURCES.md` (Blackstone canons 1–7, tanistry, Rus rota, Buganda), `CONTESTED.md`, primary pass 201bb2f | measured as rules [3]; no contest rate, sign only |
| Manor offices and powers | Bennett 1937 pp. 22, 172–191; Maitland 1889 | measured [3] |
| 60 households | Bennett ch. IX p. 239 (an average village) | calibrated estimate, applied as modelling choice |
| Yield 8–9 bu/acre; need 36–40 bu/household | Bennett 1937 pp. 88, 96 | measured [3] |
| Harvest losses 1315–17 | Campbell 2007 via Geens 2018 and Slavin 2010 | measured [3], second-hand national; validation target only (W1) |
| Rent amount, 5 acres, zero stores, 365-day years | none | assumption (modelling choice) |
| D-demo-1 remission, D-demo-2 granary | none found (searches recorded) | counterfactual [5] |
| Stub belief rule `min(1, grain/need)` | none | assumption, stand-in (C-G3) |
| kg per bushel; grain kcal/kg | Catalogue period unit masses; Life (to come) | consumed input, GOV-26 |
| Household member bodies, requirement, membership | Life (5425); Society (to come) | consumed input, GOV-27 |

### §6 Status

D designed · I implemented · C connected · N numerically checked · V empirically validated.

| Mechanism | D | I | C | N | V |
|---|---|---|---|---|---|
| Law schema, evaluate, jurisdiction | ✓ | ✓ | host only | ✓ exact | partial: 24 fixtures give their sourced breaches |
| Rule creation | ✓ | ✓ | — | ✓ | — |
| Breach chain, procedures | ✓ | ✓ | demo stubs | ✓ | — |
| Aggregate deterrence `p_s` | ✓ | structure only | — | — | — |
| Authority distribution | ✓ | ✓ | Cognition reader contract test 931f1ca | ✓ | — (Seshat planned) |
| Legitimacy aggregate | ✓ | ✓ read | contract test only | ✓ | — (no update, C-G3) |
| `may` port | ✓ | ✓ | **Settlement, combined test e5c50bd** | ✓ byte-identical | n/a |
| Taxation | ✓ | ✓ | demo stubs | ✓ stub-ledger conservation | — |
| Spending | ✓ | ✓ | — | ✓ | — |
| Property regime | ✓ | ✓ | — | ✓ | — (enclosure P8 t3) |
| Collective choice | ✓ | ✓ | — | ✓ | n/a |
| Succession, all rules and contests | ✓ | ✓ | — (reads stubbed) | ✓ | — (sign test planned) |
| Military | ✓ | ✓ | — | ✓ | — |
| Polity, treaties | ✓ | ✓ | — | ✓ | — |
| War-state record; type classifier | ✓ | ✗ | — | — | — |
| Monetary | ✓ | ✓ | Economy `purpose` (5292) | ✓ | n/a |
| Censorship | ✓ | ✓ | — | ✓ | — |
| Three-valued law evaluation (R1, R2) | ✓ (amendments) | ✗ | — | — | — |
| Cases, reports, obligations, commitments (GN-3, §B, GN-5, GN-6) | ✓ (amendments) | ✗ | — | — | — |
| Formation track F-1 to F-4 | outline only (amendments §E) | ✗ | — | — | — |
| Manor demo | ✓ | ✓ on stubs | stubs only (W1–W7 unwired) | ✓ conservation, determinism | ✗: §3 item 2 fails on stubs (GOV-16) |

The registry rows lag this table (pass 1 defect).

### §7 Validation

| Id | Mechanism | Must reproduce | Tolerance | Independence |
|---|---|---|---|---|
| V-L1 | Law evaluation | each fixture law gives its documented breach on the documented case and none on a non-case | exact | sources |
| V-L2 | Boundary | Government absent → Settlement 30-day outputs byte-identical | exact | Settlement suite |
| V-T1 | Taxation (P8 t1) | no household balance or stock changes except by an owner command; Σ levied = Σ received | exact | conservation |
| V-S1 | Succession | each sourced rule's worked cases (5077, 5080, 5331 lists) | exact | sources |
| V-S2 | Contested (P8 t2) | primogeniture gives fewer contested outcomes than election or open rules over seeded populations | sign only (Kokkonen & Sundell 2014) | no rate tuned |
| V-A1 | Authority | swapping the label vocabulary changes no run; `A` null when every `R` is null | exact | invariant |
| V-D1 | Manor determinism | same seed → same trace; seeds differ once W1, W3, W5 supply heterogeneity | exact / reported | — |
| V-D2 | Manor conservation | grain: opening + Life yield = closing + eaten + carried remainder (levy is internal); coin by command | 1e-9 relative | owners' ledgers |
| V-D6 | Yield vs sources | Life's M3 normal-year yield vs Bennett 8–9 bu/acre; deprived-run yield fraction vs Campbell 0.61 / 0.37 / 0.90 | reported, never fitted; tolerance from Life's plan | Bennett and Campbell not used to build Life's growth |
| V-D3 | Need vs Bennett | W3's annual need for a 5–6 person household vs 36–40 bushels | reported with the deviation explained, never fitted | Bennett not used to build W3 |
| V-D4 | Manor direction (§3 items 1–3) | A: share taken rises after the shock, R falls, breaches rise; B ≥ A per seed | sign and ordering (Scott 1976, Levi 1988, Tyler 1990) | only with a real update (C-G3); on the stand-in it is stub evidence |
| V-D5 | Classifier stable (§3 item 5) | one label throughout | exact | once a classifier exists |
| V-E1 | Enclosure (P8 t3) | open field vs enclosure diverge as Allen 1992 | to set with sources | held to sources |
| V-P1 | Polity (P8 t4, with P6) | Seshat size and hierarchy, H1 and H2 development, H4 held out | P11 I7, I8 | held out |

Paired configurations (PLAN-SPEC §4) for the demo: provisioned (normal harvests; Campbell 0.90) and deprived (1316 at
0.37, and the consecutive 1315–17 sequence); outcomes recorded, never tuned.

### §8 Build order

**Amended:** the checkpoints CP-1 to CP-5 and F-1 to F-4 (amendments §E) order the work; the G-stages below are the
manor wiring inside CP-5. CP-1 and CP-2 need no live engine and come first after approval (cards GN-1, GN-3, GN-5
and the GN-4 boundary). Government builds nothing for M1a–M4; it waits on them and keeps its suite green. Each stage names its dependency and
the smallest demonstration it unlocks. No unit is queued before Rex approves this plan.

| Stage | Depends on | Units (model) | Unlocks |
|---|---|---|---|
| G0 | Rex approves this plan | composer: copy PLAN.md into the repo; registry keeper: status rows | the plan in the repo |
| G1 | cognition v0.1.0 (pinned) | codex: W4 recognition adapter, static seeded beliefs; composer: test that `R` reads real Cognition stores | the demo reads real minds (static) |
| G2 (after M3) | Life plant-growth yield (M3, DC-3); Catalogue kg/bushel (GOV-26) | codex: W1 yield read from Life; composer: fixture bushel → kg, V-D2, V-D6 | Life decides the harvest; the shock is declared weather |
| G3 | GOV-28 agreed (EN-7, or `addMass` interim); ECON-5 stand-in | codex: W2 credit and levy adapter; composer: conservation test | grain in the real Economy ledger, one transfer per flow |
| G4 | 5425 built; Life bodies and requirement, Society membership (GOV-27); Life kcal/kg (GOV-26) | codex: W3 need read; composer: V-D3 report | need from bodies, checked against Bennett |
| G5 (M1a, M2 landed) | Life eat loop and capacity; Cognition intentions | codex: replace host consumption, decision and backing stubs (W3, W5, W6) | households eat, decide and tire in the manor |
| G6 (M5) | C-G3 built (Cognition A.12; C-G3a–d Rex); Society witnessing (P6) | codex: events to Cognition; composer: V-D4 paired runs | §3 on real engines; direction validated |
| G-M | `may`/holds section AGREED with Settlement 2026-11-02 | composer: copy the staged section into GOVERNMENT-SETTLEMENT.md (both repos); codex: tagged `may` in Government, appropriations via `hold`/`settle` | unknown authority handled; no double-spent treasury |
| G-S | Society agreement H6 (2026-11-02); registry row for `government.entitlement` | codex: canons callable from `property.regime` keyed by holding; composer: heriot/merchet fixtures cite `custom:<manor-community>:heriot` / `:merchet` | household inheritance under law, apart from offices |
| G-V (M5) | DC-16; Society's `unresolved` / `no_act` change landed | codex: `decide` calls Society's `collectiveChoice` and drops its own quorum/threshold/tie arithmetic; GN-2 equivalence test kept as the regression | one voting gear |
| G7 | sources for W7; GOV-Q7 interface | codex: sanction execution; battle aggregation | fines, seizures, force contests |

**Open, unchanged:** GOV-16 (default (a)), GOV-21 (i)–(iv) and contest rates, GOV-22, GOV-23 (a)(b), GOV-24 (default),
GOV-25 decided by Rex 2026-11-02 (amendments §F), C-G3 (Cognition's; Rex to release). **New:** GOV-26 (consumed input from Catalogue)
and GOV-27 (consumed inputs from Life and Society), routed by the controller 2026-11-02 through INTEGRATION-PLAN, to
Rex only if those engines' plans find no source; GOV-28 (Economy keeper: the produce contract; a risk); GOV-29
(registry REG-37: stale status rows, fixed after the stop lifts). Yield wiring follows DC-3 (W1).
