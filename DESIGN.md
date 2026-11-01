# Government: design (P8, Government keeper, 2026-10-31)

**Status: approved (Rex, 2026-10-31)**, through the controller: GOV-Q1 to GOV-Q8 decided as recorded in §5; GOV-Q1
with Rex's refinement (authority calculated from underlying causal mechanisms and observable conditions; no
independently authoritative power score; the initial formula explicitly provisional and subject to validation).
Belt units in `Games/Card Games/_agent/queue/government/` are released behind the approval marker. Every item is marked **(Rex)** = Rex's decision, **proposed** = the Government keeper's
proposal, or **open** = a question for Rex or another owner (§5 lists them, prefix GOV-Q). Evidence levels are
PLATFORM §4: (1) physical or mathematical law, (2) empirically supported statistical relationship, (3) historical
observation and interpretation, (4) simplified simulation approximation, (5) hypothesis, (6) fiction. **Most of
government is level 3–5**: political science has strong regularities in a few places (deterrence by certainty,
procedural justice and compliance, fiscal bargaining) and interpretation everywhere else. Every constant below is
`null` until a source gives it; no threshold is invented (no "legitimacy below 0.3 → revolt").

Sources read for this draft: PLATFORM.md; ENGINE_MAP.md §9 and "How they connect"; ROADMAP.md P8 (with the polity,
war and collapse items moved from P10) and the P8 demonstration; REGISTRY.md and `registry/mechanisms.json` (the 7
`government.*` rows, `settlement.authority.office_powers`, DUP-42, DUP-62, IF-17, IF-43, IF-44); ENGINES.md
"Institutions, government and religion emerge" and "History is the backend record"; Cognition DESIGN §0–§3, §15;
Settlement `src/commands.ts`, `context.ts`, `tick/wages.ts`, `tick/expiry.ts`.

## 0. What Government is, and its fence

**(Rex, 2026-10-31)** No government type is ever assigned. The engine computes the **distribution of authority**;
monarchy, council, republic, empire and the rest are labels of the result, reached by many pathways (negotiation,
conquest, inheritance, religious authority). **Laws are executable institutional rules as data**, never text or a
modifier. **A law can exist and not be obeyed**, and **enforcement can fail** for want of resources, witnesses,
cooperation or legitimacy. Legitimacy is gained or lost by mechanism, never assigned (ENGINE_MAP §9).

**The ordering principle:** physics decides what can happen, biology what an organism can do, cognition what it
attempts, society the institutions and incentives around the attempt. Government is the part of "institutions" that
is **rules with recognised authority behind them**: who may make a rule, what the rule says, where and to whom it
applies, whether an act broke it, and what the institution can do about it.

**Scope (controller's brief, 2026-10-31):** authority acquisition and delegation; rule creation and amendment; the law
schema and the evaluation chain; compliance and enforcement (courts and policing); succession; competing
jurisdiction; taxation and spending; property-rights regimes; military organisation; diplomacy; legitimacy;
censorship; polity formation, expansion, fragmentation, war decisions, collapse and transition (moved from P10).

| Not Government's | Owner | How Government gets it |
|---|---|---|
| Who holds an office; the office, permission, title, lease records; the ledger and money | Settlement (DUP-62, §2.3) | `SettlementReader` and commands (`appoint`, `vacate`, `pay`, `transfer`) |
| Whether anyone **attempts** an act, obeys, reports, enforces, rebels, votes, declares war | Cognition (each ruler, enforcer, witness and subject is a mind) | intentions (IF-43); Government never decides a person's choice |
| Whether an act **succeeds** (a theft, a blow, a march, a harvest) | Reality, Life | outcome events |
| Goods, prices, incomes, production | Economy | Economy reads (taxable flows, weapons, food stocks) |
| Organisations, networks, norms, doctrine, collective action, grievance as a shared state | Society (P6) | Society reads; Government never keeps a second organisation register |
| Belief that an institution is rightful (each person's legitimacy belief) | Cognition (`cognition.belief.update`) | Government **aggregates on read**, stores no legitimacy meter (§1.8) |
| What people know of laws, past rulers, past wars | Cognition (fallible routes) | Government's law records are world facts; minds learn them by communication |
| The record of what happened, and the label "monarchy" | History (record), Catalogue (vocabulary) | Government writes events; the classifier is a read with no consumer (§1.2, GOV-Q2) |
| Time, ids, events, RNG, units, transactions | Kernel | `@rex/kernel` |

**Package (proposed):** `Toolchain/government/`, git repo on `master`, `@rex/government`, TypeScript and vitest,
imports `@rex/kernel` only; every engine it reads (Settlement, Economy, Cognition, Society) is reached through
ports declared in `kernel.json`, so the package compiles and tests with stub providers before P6 exists.

## 1. The mechanisms

Registry search before naming (PLATFORM §7, done 2026-10-31): the 7 planned `government.*` rows are adopted as they
stand. No row exists for legitimacy, taxation, spending, property regime, military, diplomacy, war, collective
choice, polity or diplomacy; eight rows are **proposed** below (§1.8–§1.14) to the registry keeper. Settlement's built
`settlement.authority.office_powers` is the one overlap (DUP-62, §2.3); `settlement.wage.pay` publicWorks is DUP-42
(§1.9).

### 1.1 The law record (`government.law.schema`, adopted) — leads the design

**(Rex)** jurisdiction, regulated action, condition, legal consequence, enforcing body, exceptions. **Proposed**
concrete schema, executable data; every field is a reference or a predicate in a small declared expression language,
never free text that code interprets:

```ts
type Law = {
  id: LawId                              // kernel id, 'gov:law:…'
  issuer: AuthorityId | null             // the office or body whose rule-making power made it (§1.3), if sourced
  enactment: EventId                     // the event of making it, under a procedure (§1.3); the law's provenance
  modality: 'prohibit' | 'require' | 'permit' | 'empower' | 'establish'
  //   prohibit/require/permit: primary rules on conduct (Hart 1961)
  //   empower: confers a power on an office: "the reeve may seize", "the council may levy" (Hart's power-conferring rules)
  //   establish: creates an office or body (the record is Settlement's createOffice; the rule that it exists is here)
  jurisdiction: {
    authority: AuthorityId | null        // whose jurisdiction (§1.6), if sourced; rival authorities may cover one act
    places: PlaceSet | 'all'             // Settlement parcels/districts, a polity's territory, a ship
    persons: Predicate | 'all'           // membership, status, religion, residence, age: read from the owners' state
    from: Day; until: Day | null
  }
  regulated: {
    action: ActionKind                   // from the shared action vocabulary (GOV-Q4): Cognition repertoire kinds,
                                         // Settlement command types, Economy trade kinds
    object: Predicate | 'any'            // a good kind, a title class, a person, a message (censorship, §1.7)
    power?: PowerKind                    // for 'empower': the power conferred ('seize','levy','permit','judge','declare-war')
  }
  condition: Predicate                   // when the rule applies: time, place, quantity, whether a permission is held
  exceptions: Exception[]                // {condition, reason}; e.g. holders of a permission of kind k; clergy; feast days
  consequence: Consequence               // what follows a breach: Sanction[] (fine, seizure, detention, corporal, outlawry,
                                         //  exile) as commands to the state owner, or 'void' (the act is not recognised:
                                         //  a sale of entailed land does not transfer the title)
  enforcer: AuthorityId[]                // the office or body charged with detection and sanction
  procedure: ProcedureId | null          // adjudication (§1.4): who judges, by what proof
  status: 'in-force' | 'suspended' | 'repealed'
  supersedes: LawId[]
  sources: Citation[]                    // for historical laws: the source of the rule (e.g. Statute of Labourers 1351)
}
```

`Predicate` is a closed expression language (and / or / not / compare over named reads: `place.in`, `person.status`,
`quantity.gte`, `holds.permission`, `day.in`), each read a declared port. A law is **evaluated**, never applied as a
modifier: nothing in any engine multiplies a number by a law.

**Evaluation chain (Rex, IF-43, IF-44):**

1. **Attempt** — Cognition: a mind selects an intention for act `a` (it may know the law, believe it wrongly, or not
   know it; it may weigh the believed chance of sanction; that is its evaluation, not Government's).
2. **Success** — Reality and Life: the act happens or fails (a failed theft can still be an attempted theft in law;
   whether attempt is a breach is a law's `regulated` field).
3. **Property interest** — Settlement: titles, leases and permissions say whose property the act touched (IF-44).
4. **Breach** — Government, `government.law.evaluate` stage of `compliance.enforcement`: the laws in force whose
   jurisdiction covers (place, person, day), whose `regulated` matches the act, whose `condition` holds and no
   `exception` holds. A breach is an objective record (`government.violation`, status `undetected`). **It exists
   whether or not anyone knows** (the backend truth; no mind reads it directly).
5. **Detection** — Cognition: a witness or enforcer perceives the act (`cognition.perception.detect`), or someone
   reports it (communication). Government records the breach as `known-to(enforcer)` only when an enforcer's mind
   holds an observation or testimony of it.
6. **Prosecution** — the enforcer mind decides to act (Cognition), within the procedure (§1.4): proof standard, judge.
7. **Sanction** — the consequence runs as commands to the state owners (a fine is a Settlement `pay`; a seizure is
   Settlement `transfer` kind `seizure`; detention moves a person through the host; corporal punishment is a Life
   injury), only if the enforcer has the capacity (§1.4, §1.13) and the subject does not resist successfully (a contest
   decided by Reality and Life).

Stages 4–7 are recorded separately, like communication's four stages: **breach ≠ detection ≠ prosecution ≠
sanction**. Compliance is never a field; it is the observed share of opportunities in which no breach occurred.

- Inputs: the attempted act (actor, action kind, object, place, day) and outcome; Settlement records; laws in force.
- Outputs: `government.violation` records with their stage.
- State: the law set (owned by `rule.creation_amendment`; this row is the schema and the evaluator).
- Timescale: event-driven, on each act outcome; aggregate mode (§1.5) per day for distant populations.
- **Dates and repeal (keeper, 2026-10-31, after review of unit 2866).** In a running world `jurisdiction.from` and
  `until` are kernel days (the schema's `number`). A data file written from a source writes them as calendar points
  `{year, month?, day?, calendar}` (calendar `julian` for England before 1752, as the source gives); `loadLaws(root,
  toDay)` converts them with a host-supplied `toDay`, the host's calendar (the Catalogue's date normalisation,
  `catalogue/src/dates.ts`, is the intended one; Government imports no engine). A year-only `from` is the first day of
  that year; a year-only `until` is the first day of the repeal year (the law is not in force during it). A century or
  "date not stated" repeal is `until: null` with a note. A law repealed after its source period is written
  `status: in-force` with the repeal in `until`; `status: repealed` is reserved for a repeal that happens inside a
  run (an event). The fixture's subject is England c. 1300; no date is added that SOURCES.md does not give.
  **No sourced start (keeper, 2026-10-31, after review of 2888/2889):** a law the sources show in force only "before"
  some date, or with no period at all (frankpledge, heriot, merchet, suit of mill), is written `from: null`, meaning
  "no sourced start": in force on every day before `until`. No coverage bound such as 1215 is written as a start;
  the `before <date>` evidence stays in the source note. `from: null` never means "unknown, so not in force".
- **No sourced issuer:** when the source names no issuer or authority, `issuer` and `jurisdiction.authority` are
  `null` (`string | null` in the schema and loader), with a note that issuer and authority are not stated in the
  source. A null-authority law never supersedes another law and is never superseded; `applicableLaws` keeps each
  in its own set keyed `unstated:<law id>`. `deJure` credits no actor with a null authority (`J = 0`), and
  `delegationChain` skips null issuers.
- **Supersession (keeper, 2026-10-31; confirms unit 2864):** a law is superseded only by an in-force law of the
  **same** jurisdiction authority; a rival authority's law never repeals another's (§1.6), it competes with it.
- Invariants: a law changes no number in another engine; consequences are commands to owners; the same act under the
  same laws gives the same breach set (deterministic); a repealed law produces no breach for acts after repeal.
- Evidence: the schema is legal theory (Hart 1961, *The Concept of Law*: primary and secondary rules; Hohfeld 1913,
  rights, duties, powers, immunities) — level 3 as a description of real law; the evaluator is level 1 (logic).
- Approximations: law is crisp; real law has open texture (Hart) resolved by judges — a judge's mind decides contested
  predicates (Rex, 2026-10-31, GOV-Q5); the procedure names the judge.
- Rate limiter: one evaluation per act outcome; the number of laws scanned is bounded by a jurisdiction index.
- Failure mode: an act no law covers is lawful (no default prohibition); a predicate that reads a missing port
  throws; contradictory laws from one issuer resolve by `supersedes`, from rival issuers stay contradictory (§1.6).
- Validation: (V) a fixture of 20 historical rules (Statute of Labourers 1351, Assize of Bread and Ale c.1266, a
  forest law, a sumptuary law, a burial law) encode without free text and give the documented breach on the
  documented case; (V) property-crossing acts read Settlement only.
- Consumers: Cognition (laws as learnable world facts), Settlement (permit requirement, office powers through
  §2.3), Economy (tax and trade rules), Society (norm vs law divergence), History (record).

### 1.2 The distribution of authority (`government.authority.acquisition_delegation`, adopted) — leads the design

**(Rex)** The distribution of authority is computed; a government type is only a label of the result.

**Proposed model.** Authority is a relation, not a stat: actor `k` (a person through an office, or a body) has
authority over person `i` in domain `d` (a set of action kinds or powers) to the degree that `k`'s commands in `d` are
**recognised** and **backed**. Two parts, after Acemoglu & Robinson's de jure vs de facto power (2006, *Economic
Origins of Dictatorship and Democracy*; level 3):

```
de jure:   J(k, d, i) ∈ {0,1}   — some law in force, made by a recognised rule-maker, confers d on k's office over i
recognition: R(k, d) = Σ_i ω_i · b_i(k, d) / Σ_i ω_i
             b_i(k,d) ∈ [0,1]: person i's belief that k's commands in d ought to be obeyed (Cognition's belief, read)
             ω_i ≥ 0: i's weight in enforcing or resisting = the resources i commands (arms, followers, wealth, office)
backing:     C(k) = Σ_{j ∈ agents of k} κ_j · y_j
             κ_j: agent j's capacity to act (Life capacity; Economy equipment), y_j: j's own b_j(k,d) (loyalty)
effective authority: A(k, d) = f(J, R, C)  — provisional (Rex, 2026-10-31, GOV-Q1); first candidate f = R · C/(C + C_opp)
             C_opp: backing of the strongest actor contesting k in d (rival claimant, a rebel organisation)
```

The weights `ω_i` make this a **selectorate structure** (Bueno de Mesquita, Smith, Siverson & Morrow 2003, *The
Logic of Political Survival*, level 3–4): whose belief counts is weighted by what they control, so a regime can rest
on a small coalition of armed or propertied people while most subjects do not believe in it. Weight is itself read
from other owners (Settlement holdings, Economy goods, Society followers), so no constant decides who matters.

**How authority is acquired** (each a pathway through existing mechanisms, never a branch that picks a type):

| Pathway | What moves | Owner of the move |
|---|---|---|
| Negotiation / election | `b_i` of the people whose `ω` is large rise through a procedure's outcome (§1.12) | Cognition (beliefs), Government (procedure) |
| Conquest | `C` exceeds `C_opp`; `J` follows when the victor makes laws; `R` may lag for generations | Reality/Life (the fight), Government (records) |
| Inheritance | a succession law (§1.5) names the heir; `R` carries over to the degree people believe in the rule | Government (rule), Cognition (belief) |
| Religious authority | Society's doctrine raises `b_i` for an office; Government's religious law recognises it | Society, Cognition, Government |
| Delegation | `k` makes an `empower` law for office `o` under it; the agent's `y_j` decides whether it obeys `k` | Government, Cognition |

**Delegation** is a tree (or graph) of `empower` laws: the reeve's power derives from the lord's law, the lord's from
the king's. The principal–agent problem (agents shirk, steal revenue, obey a rival) is the agents' own decision
(Cognition), not a leak rate (Kiser 1999, "Comparing varieties of agency theory", level 3).

**The label (Rex, 2026-10-31, GOV-Q2).** Government exposes only the distribution; the label vocabulary is the
Catalogue's and History reads the label. The classifier, wherever it is hosted, is a pure read: concentration of `A` across actors (Herfindahl over `A(k, d)`),
how apex offices are filled (the succession and selection laws), the winning-coalition share `W/S`, whether
religious offices hold `d` in civil domains, and whether there is one apex or several. It returns a label from the
Catalogue's vocabulary with its features. **No mechanism reads the label.** The registry invariant already says "History or Catalogue may label them".

- Inputs: `mind.belief` (b_i), `society.organisation_event`, Settlement holdings and offices, Economy goods, Life
  capacity, the law set. Outputs: `government.authority_distribution`.
- State: none of its own beyond the law set and a cached read; recomputed when inputs change.
- Timescale: daily in full resolution; per long step in aggregate.
- Invariants: no government type is stored or read; `A` is never written by a script; changing a ruler's title does
  not change `A`.
- Evidence: de jure/de facto (3), selectorate (3–4), Weber's three grounds of legitimate authority (traditional,
  charismatic, legal-rational; Weber 1922) as the **classification of what beliefs `b_i` rest on** (3).
- Approximations: `f` is a level-5 hypothesis (GOV-Q1); domains are coarse action-kind sets.
- Rate limiter: authority changes only as fast as beliefs, capacity and laws change (each owned and rate-limited
  elsewhere); there is no authority growth rate.
- Failure mode: authority collapses where `R` and `C` fall together; it can persist with low `R` and high `C`
  (occupation) or high `R` and low `C` (a respected but powerless court).
- Validation: (V) Seshat polity variables (Turchin et al. 2015, *Seshat*, cliodynamics) as the independent check on
  the label vs simulated structure for the benchmark societies; (T) swapping the label vocabulary changes no run.
- **Granularity, rivals and places (keeper, 2026-10-31; settles unit 2867's three assumptions).** (1) `J` is per
  subject person, so the distribution is computed per (actor, domain, person); an aggregate over a jurisdiction is a
  read of those rows, never a stored total. (2) Rivals are **not** every other actor: `C_opp` is the largest backing
  among actors that claim the same domain over the same persons and are not on the actor's own delegation chain (an
  `empower` chain linking them either way); a lord and his reeve are never rivals. The host may also name rivals
  explicitly (a contested succession). (3) A jurisdiction id is not a place id: the persons come from
  `PopulationReader.persons(jurisdiction)` and each person's place from a `facts` read (`person.place`), which is what
  law applicability tests.
- Consumers: `rule.creation_amendment`, `jurisdiction.competing`, `succession.institutional`, `polity.structure`.

### 1.3 Rule creation and amendment (`government.rule.creation_amendment`, adopted)

Who may make or change a law is itself a law (Hart's **rule of change** and **rule of recognition**): an `empower` law
with power `legislate` over a domain, plus a procedure (one person's decree, a council's majority, an assembly, a
custom recognised by a court). A rule made outside any recognised procedure is still recorded (a usurper's decree)
with its issuer; whether anyone obeys is §1.4. Religious law and the recognition or restriction of religions are
laws of this row (ENGINES.md, Rex). Customary law is **proposed** as laws whose issuer is "custom" and whose
enactment is a court's recognition of practice (Society's norm becomes Government's law only through a recognition
event; Rex, 2026-10-31, GOV-Q6; to agree with the Society keeper).

- Outputs: `government.law` records. Timescale: event (an enactment). Rate limiter: the procedure (a council meets
  when it meets; a decree needs the issuer's intention). Failure mode: a procedure without quorum produces no law;
  rival legislators produce rival law sets (§1.6). Evidence 3. Validation: the enclosure test (§4, ROADMAP P8 t3).
- **Domain of a draft (2934's reading, adopted):** the "domain" the `legislate` power is checked over is the draft's
  `regulated.action`. Enactment calls `deJure(laws, issuer, 'legislate', {id: subject, place}, day, facts, action)`
  with that action as `deJure`'s optional (last) action argument (src/law/enact.ts). A null issuer is never
  recognised.

### 1.4 Compliance and enforcement (`government.compliance.enforcement`, adopted) — courts and policing inside

The stages 4–7 of §1.1. Two resolutions (PLATFORM §9; refinement B: one owner, a documented aggregation):

- **Full:** every enforcer, witness and judge is a mind; detection and sanction happen or not by their choices and
  Reality's outcomes.
- **Aggregate (distant populations):** the expected deterrent a breach faces is
  `p_s = p_detect · p_prosecute · p_capacity`, with each factor estimated **from the full-resolution runs or sources**,
  never set. Deterrence evidence: the certainty of sanction deters more reliably than severity (Nagin 2013, "Deterrence
  in the twenty-first century", *Crime and Justice* 42; level 2); Becker 1968 expected-cost model as the structure
  (level 4 as behaviour; the behavioural choice remains Cognition's even in aggregate, through Society's aggregation).
- **Procedural justice:** whether people obey depends on whether they judge enforcement fair (Tyler 1990, *Why People
  Obey the Law*; Tyler & Huo 2002; level 2 for the correlation, contested causal size). In this design that enters as
  evidence for Cognition's legitimacy belief (§1.8), not as a compliance multiplier here.
- **Adjudication** (`procedure`): judge office, proof standard (two witnesses, oath, ordeal, jury), appeal. A
  procedure is data; the judge's decision is a mind's.
- **Procedure for the §3 manorial breach (decision, 2026-11-01): keep both records, each with its own scope.**
  The §3 theft and levy-payment breaches use `government/procedure.manorial-court-presentment-by-jurors-or-homage`
  (data/procedures/SOURCES.md, 2935): it is the only record whose source states how an offence with no private
  plaintiff begins (jurors or tithingmen present it), who presents (a jury of twelve, often chief pledges, before
  the steward) and what stands as proof (the presentment; untraversable unless it touches freehold). Its limits
  carry over: the evidence is Maitland on 13th-century leets, the homage reading is modern, appeal is not stated.
  `government/procedure.manor-three-weekly-court` (built by 2936 from data/laws/SOURCES.md) stays the assize law's
  procedure: its source names only the lord's three-weekly court and ale-tasters sworn at the court leet, and
  states no judges, start, proof or appeal. The two are not linked or merged, because no source read says the
  three-weekly court proceeded by presentment; no law's procedure ref changes.

Rate limiter: enforcer person-hours and their capacity (Settlement posts, Life labour supply). Failure mode: no
witness → undetected; enforcer refuses (low `y_j`) or is bribed (an Economy exchange decided by two minds) → no
prosecution; resistance outmatches enforcers → sanction fails; each failure is a recorded stage.

### 1.5 Succession (`government.succession.institutional`, adopted)

On death (Life's `body.crisis` → death), removal, abdication or end of term, the succession law of the office names
the rule (primogeniture, election by a body, appointment by a superior, rotation, tanistry, open contest); the rule
read with Society's kinship and Life's living persons yields a **claimant set** with each claimant's basis. One
claimant and recognition → Government emits `government.succession_event` and Settlement records it by `appoint`.
Several claimants, or a rule the community does not recognise → a **contested succession** arises from the rules and
the claimants (ROADMAP P8 t2): rival `b_i` and `C`, possibly rival jurisdictions (§1.6), resolved by negotiation,
procedure or force, never a script. Evidence: Kokkonen & Sundell 2014 (primogeniture and the survival of European
monarchs, *APSR*; level 2–3); Goody 1966 *Succession to High Office* (3). Rate limiter: the event. Failure mode: no
eligible claimant → vacancy (Settlement `vacate`); the office's authority then decays only through §1.2's inputs.

### 1.6 Competing jurisdiction (`government.jurisdiction.competing`, adopted)

Which authority's laws cover a person, place or act. Jurisdiction claims are laws (`jurisdiction.authority`); claims
overlap (crown and church courts, a town charter and a lord, a ship's articles and a port, two claimants). The row
outputs, per act, **every** applicable law set with its authority; it never picks a winner. Which one is enforced is
decided by enforcers' choices and capacity (§1.4). Evidence: legal pluralism (Benton 2002, *Law and Colonial
Cultures*; Berman 1983, *Law and Revolution*; level 3). Failure mode: an act lawful under one and unlawful under
another produces a breach under the second only.

### 1.7 Censorship and suppression (`government.suppression.communication`, adopted; IF-17)

A suppression is a law with `regulated.action` a communication kind (speak, write, print, assemble, carry a message)
and an `object` predicate on content or medium. It writes `society.comm_restriction` (who may send what by which
medium where); Cognition's senders read it as a cost and a detection risk (IF-17), and detection uses
`cognition.communication.detection`. Outcomes are not fixed (Rex): compliance, resentment, alternative networks.
Evidence: King, Pan & Roberts 2013 (Chinese censorship targets collective-action content; *APSR*; level 2).

### 1.8 Legitimacy as an aggregate of beliefs (`government.legitimacy.aggregate`, **proposed new row**)

**Proposed.** Legitimacy is **not stored in Government**. Each person's legitimacy belief `b_i(k, d)` is a Cognition
belief, formed and revised by `cognition.belief.update` from experiences the mind attributes to the institution
(`cognition.learning.attribution`; ENGINES.md already gives Cognition "blames the government, the merchants,
outsiders, themselves"). Government's row is the **aggregation read** `R(k, d)` of §1.2 (and its unweighted
counterpart, the share of subjects who believe), with its population, weights and resolution documented. In
aggregate resolution the population's belief distribution is Society's aggregate of Cognition (refinement B).

What moves `b_i` (evidence for Cognition's update, the inputs Government makes observable as events):

| Experience | Source and evidence |
|---|---|
| Extraction relative to what is left for subsistence, not the nominal rate | Scott 1976, *The Moral Economy of the Peasant* (3); Thompson 1971, "The moral economy of the English crowd" (3) |
| Whether the institution keeps its side: protection, justice, relief (contingent consent) | Levi 1988, *Of Rule and Revenue*; Levi 1997, *Consent, Dissent and Patriotism* (3) |
| Procedural fairness of enforcement experienced or witnessed | Tyler 1990; Tyler 2006 (2) |
| Whether others comply (quasi-voluntary compliance: I pay if others pay) | Levi 1988 (3); conditional cooperation, Fischbacher, Gächter & Fehr 2001 (2) |
| Tradition, doctrine, kinship to the ruler | Weber 1922 (3); Society doctrine (P6) |
| Outcome performance: famine, defeat, plague attributed to the ruler | Hsiang-style climate–conflict meta-analyses (Hsiang, Burke & Miguel 2013, *Science*; 2 for the aggregate correlation) |

- Outputs: `government.legitimacy` (a read, kind `aggregate`, recomputed, never written by an update).
- Invariants: no number here is incremented by an event; the only way legitimacy changes is that minds change.
- Validation: the P8 demonstration (§3) and H4 Copán (held out: "collapse of institutions before people").
- **Seam to watch:** Cognition's belief update must accept an institution as a belief subject (GOV-I to Cognition
  keeper); Society's population aggregate must be the one aggregate (no second in Government). Proposed DUP-free by
  construction; registry keeper to confirm.
- **Reading (2975, as built):** the unweighted counterpart is `shareBelieving`, the mean P(true) over subjects with a
  known belief, with no belief threshold and no resource weighting; null beliefs are excluded from it and from `R`,
  and `populationSize` still counts them.

### 1.9 Taxation (`government.fiscal.taxation`, **proposed new row**; closes DUP-42 with Settlement)

A tax is a `require` law: who pays (`persons`), on what base (a read: harvest in Economy inventory, a title in
Settlement, a head, a trade), at what schedule (a predicate-valued function of the base: rate, fixed sum,
proportional with remission), when, to which treasury account, enforced by whom. **Assessment** is Government's
(compute what is owed); **payment** is the payer's choice (Cognition; or aggregate) and the money or goods move only
through Settlement's ledger `pay` or Economy's inventory transfer (ROADMAP P8 t1). Non-payment is a breach (§1.1).
Tax farming, tribute and corvée are the same record with a different base and collector. Assessment and collection run in
Government's own process phase, paying through Settlement's `LedgerProvider` (§2.3); Settlement's `publicWorks` step
stays a no-op. Evidence: Levi 1988 (3); Tilly 1990, *Coercion, Capital and
European States* (3); Besley & Persson 2011 on fiscal capacity (2–3). Rate limiter: the schedule and collectors'
person-hours. Failure mode: evasion (undetected breach), inability to pay (the base is not there), collector
diversion.

### 1.10 Spending (`government.fiscal.spending`, **proposed new row**)

The treasury is a Settlement account. Spending is the holder of a spending power (an `empower` law) choosing
(Cognition) or a rule appropriating (an `require` law on the treasury: "a tenth to the church", "pay the watch")
within the balance. Payments are Settlement `pay` rows; public works are Settlement businesses with `publicWorks`
true (already built). Government owns the appropriation rules and the record of what was promised; it decides no
expenditure itself. Failure mode: an appropriation without funds is unpaid (a breach of the institution's own law,
which is evidence for legitimacy beliefs).

**Reading (2978, as built):** appropriations allocate within the balance in enactment order, which is the
host-supplied law array order (enactment IDs are opaque, not dates). A spending law's amount is its top-level
`schedule` (`fixed` amount, or a rate on a base read), not a field inside the predicate.

### 1.11 Property-rights regimes (`government.property.regime`, **proposed new row**)

A regime is the set of laws over Settlement's title and lease commands: which title classes may exist, whether and to
whom they transfer (`transferable`), inheritance rules (SET-11), commons and access rights, enclosure, entail,
seizure grounds. Settlement keeps the titles and executes the commands; Government's laws decide whether a command is
lawful (`void` consequence: an unlawful sale does not transfer) and Settlement's `transferable` field becomes a read
of the regime when Government is present (§2.3). Test: ROADMAP P8 t3, the same society under open fields vs enclosure
diverges as the sources describe (Allen 1992, *Enclosure and the Yeoman*; Clark 1998, "Commons sense"; level 3).

**Reading (2979, as built):** `transferable` returns `null` when no in-force `transfer` law's conditions hold, so
Settlement's setup field stands. When one does, it returns whether the transfer is lawful (no void breach). A
`require` law on `transfer` whose required condition is met therefore makes `transferable` true, not null: a
regime that speaks and permits is a yes, not silence.

### 1.12 Collective choice procedures (`government.collective_choice.procedure`, **proposed new row**)

When a body rather than a person decides (a council, an assembly, an electorate, a jury), the procedure aggregates
the members' individual intentions (Cognition) into one decision: who may vote, weights, quorum, threshold, agenda,
order. Data, executed exactly; strategic voting and coalition-making are the members' minds. Evidence: social choice
is level 1 for what a rule does with given ballots (Arrow 1951; May 1952); level 3 for which rules real bodies used.
Consumers: rule creation, succession by election, war declaration by a council, treaty ratification.

**Reading (2976, as built):** `decide` reports `unresolved: 'tie' | 'chair-choice-missing'` with `adopted: false`
when a tie has no rule (`tie: null`) or a chair rule lacks the host's casting choice. `enact` reads only `quorate` and
`adopted`, so such an outcome reaches it as plain `not-adopted`.

**Decision (keeper, 3009):** `EnactmentResult` should carry the `unresolved` reason. An unresolved tie is a gap the
host must fill (no source decided it), not a rejection under the body's rule; collapsing it to `not-adopted` hides
unknown as no, against the null-means-unknown convention used elsewhere (succession keeps no heir unresolved). Shape:
the body outcome accepts `decide`'s `unresolved`; `EnactmentResult` gains
`{ law: null; failure: 'unresolved'; unresolved: 'tie' | 'chair-choice-missing' }`, checked after `not-quorate` and
before `not-adopted`. No law is created and no default vote is invented. Implementation: codex unit 3010.

### 1.13 Military organisation (`government.military.organisation`, **proposed new row**)

An armed force is an organisation (Society's actor record, DUP-58 watch) under an office holding `command` and
`levy` powers: recruitment rules (feudal levy, paid troops, conscription, militia: `require` and `empower` laws),
pay and supply (Economy goods, Settlement ledger), command structure (a delegation tree, §1.2), discipline (laws with
enforcers inside the force). Its **capacity** `C` is a read: persons (Life), equipment (Economy), supply on hand,
loyalty (`y_j`). Fighting is Reality and Life (P2 demonstration: two fighters); at battle scale an aggregation
interface is needed (Lanchester 1916 equations as a level-4 aggregate, explicitly an approximation of many resolved
contests; Rex, 2026-10-31, GOV-Q7: a shared aggregation interface, Reality the physics, Government the decision). Tilly (1990) war-makes-states feedback arises from tax (§1.9)
funding force (§1.13) enforcing tax.

**Reading (3011, as built):** `chainOfCommand(...).chain` is `delegationChain`'s output: the sorted connected set
of actors linked to the office through in-force grants, not a ranked chain of superiors. It says who is in the
command structure, not who outranks whom; rank is not read.

### 1.14 Diplomacy, war and polities (`government.polity.structure`, `government.diplomacy.relations`, **proposed new rows**)

- **Polity** (proposed `government.polity.structure`): a read of the authority graph. A polity is a set of
  jurisdictions whose apex authorities resolve to one apex through recognised `empower` chains; its territory is the
  places of those jurisdictions where the apex's effective authority is the largest. **Formation, expansion,
  fragmentation and collapse are changes in that graph** produced by §1.2's inputs (beliefs, capacity, laws,
  conquest), never an event that a polity "collapses". Collapse = the apex's `A` falls below a rival's across its
  former territory, or the graph splits. Evidence for drivers to test (each a level-3/5 hypothesis held side by side,
  PLATFORM §4 keeps competing explanations): Carneiro 1970 circumscription; Olson 1993 stationary bandit; Tilly 1990;
  Turchin & Nefedov 2009 structural-demographic theory (elite overproduction, fiscal strain; P11c baseline);
  Tainter 1988 diminishing returns to complexity. ROADMAP P8 t4 with P6.
- **Diplomacy** (proposed `government.diplomacy.relations`): treaties, truces, alliances, tribute and marriages are
  law records whose jurisdiction spans two authorities and whose enforcer is each party (or none: no world
  enforcer). Negotiation is Cognition's (V-M1 two merchants is the template; IF-18 for executed agreements).
- **War decisions:** the decision to go to war is a ruler's or a body's (Cognition, through §1.12 if a body).
  Government supplies the institutional facts the decision reads: who may declare war (a power), the forces and
  revenues available, the treaty obligations, and the legal state of war (a record that changes which laws apply).
  The **reasons** are those of real minds under Fearon's (1995, "Rationalist explanations for war") bargaining
  failures (private information and incentives to misrepresent, commitment problems, indivisible stakes; level 3)
  plus non-rational reasons Cognition owns (honour, revenge, doctrine). No war is scripted.

**Reading (2981, as built):** territory is decided per domain × person, not per place. `polities` records each
(jurisdiction, place, domain, person) winner in `territory`, the place being the person's `person.place`, and adds
it to each winning apex's list, so one place can sit in two polities (one apex wins taxation there and another
justice, different persons living there have different winners, or a tie keeps both apexes). No single territorial
score is formed; a polity's `territory` is a union of places, not a partition.

### 1.15 What is deliberately not a mechanism here

No government type state, no legitimacy meter, no stability meter, no rebellion threshold, no corruption rate, no
"tax efficiency" constant, no tech or era gate on institutions (a society may invent a bureaucracy early if the
mechanisms allow it). Each is an output to observe.

## 2. Interfaces (kernel ports)

### 2.1 Reads (all provider ports; stubs until the provider exists)

| Port | Provider | Read | Status |
|---|---|---|---|
| `SettlementReader.offices / titles / leases / permissions / accounts` | Settlement | `settlement.office` holders, property interest (IF-44) | built provider |
| `LedgerProvider.balance / transfer` | Settlement | treasury balance; tax and fine payments | built provider |
| `ActOutcome` | host on the kernel clock (Cognition intention + Reality/Life outcome) | the attempted act and its outcome (IF-43) | planned |
| `BeliefReader.recognition(i, k, d)` = port `government.port.recognition` | Cognition serves it (pure read of `mind.belief`) | P(true) of the categorical belief `ought_obey:<domain>` about the mind's own handle for `k`; host maps actor ids to handles; no entry = `null` (missing, excluded from aggregates, never 0) | **agreed with the Cognition keeper 2026-10-31**; Government a consumer of `mind.belief`, never a writer |
| `ObservationReader` | Cognition | witness observations, testimony held by enforcers | planned |
| `CapacityReader` | Life | `body.capacity_functional` of enforcers and soldiers | planned (DUP-15) |
| `InventoryReader` | Economy | tax bases in goods, weapons, supply | built provider |
| `OrganisationReader`, `KinshipReader`, `PopulationAggregate` | Society (P6) | organisations, kin for succession, aggregate beliefs | planned; stubs |

### 2.2 Writes

`government.law`, `government.violation`, `government.authority_distribution` (read-cache), `government.jurisdiction`,
`government.succession_event`, `society.comm_restriction`, proposed `government.tax_assessment`,
`government.appropriation`, `government.polity`, `government.treaty`. Effects on other engines' state are **commands
to their owners**, never writes: Settlement `appoint`, `vacate`, `pay`, `transfer`, `createOffice`; Economy
inventory transfers; Life injury (sanction).

### 2.3 The office-powers boundary with Settlement (DUP-62; agreed with the Settlement keeper 2026-10-31; owner split approved by Rex in batch 2b, 2026-10-31; acceptance test agreed by both keepers, GOV-8)

1. Settlement keeps the only copy of offices `{id, name, holder, seat}` (`holder` written only by `appoint` and
   `vacate`), permissions and their expiry, titles, leases, the ledger and `pay`. Government keeps no second copy.
2. Government owns what an office may do. `officeHas` (`settlement/src/context.ts:78`) becomes a call to the provider
   port `AuthorityProvider.may(office, power, subject, day) → boolean`, declared as an `in` port (kernel DESIGN §8.1).
   The **default provider reads today's `Office.powers[]`**, so the thirty-day run stays byte-identical. Settlement
   keeps the null-office and vacancy checks and today's error texts. Call sites: `commands.ts:178` (public-title),
   `:212` (seize), `:624` and `:637` (permit); all at command time, none at tick time.
3. Succession: Settlement has no succession law (`inherit` takes an heir its caller names). Government replaces the
   host as the one who names the heir, and Settlement records it by `appoint` or `inherit`. **Which inheritance law
   applies to any particular world (e.g. the pirate town, SET-11) is Rex's, not either keeper's.**
4. Permits (Settlement's amendment, accepted): `startProject.permitRequired` stays a field the caller supplies; the
   host fills it from Government's `require` law when Government is present. No second provider call inside
   Settlement's commands; the default stays as today.
5. Tax (DUP-42; Settlement's amendment, accepted): tax runs in **Government's own process phase**, not inside
   Settlement's `publicWorks` step. Government computes each assessment and moves the money through
   `LedgerProvider` (`pay`/transfer), as Economy does (Settlement CONTRACTS §3), so the ledger stays money's one
   home. `publicWorks()` stays a no-op; its tax comment is retired once Government takes tax.
6. `createOffice.powers` stays valid setup data; with Government present it is a read of Government's grants.
7. The boundary becomes a **two-keeper contract file** under the Settlement–Economy rule: append-only sections, each
   agreed by both keepers, byte-identical copies in both repos, never edited by a belt unit. Written after Rex
   approves this design, when the Government repo exists.

## 3. The first demonstration: an institution gaining or losing legitimacy (ROADMAP P8)

**Name:** `demo/legitimacy-harvest`. Headless, seeded, writes its trace, passes the P0 conservation checks, no pirate
content.

**World (proposed fixture; every number labelled; historical first; reconciled with `data/demo/SOURCES.md`,
3084):** one village of 60 households modelled on a documented English manor c. 1300. The 60 is Bennett's own
estimate for an average village (about 300 souls, some 60 families; Bennett 1937 ch. IX p. 239, `households-per-village`, 5006),
not a count for any one manor; using it for this manor is a **modelling choice**. Grain yield (8–9 bushels per acre,
about four times the seed; `grain-yield`) and household need (36–40 bushels a year; `household-subsistence`) are
Bennett's; Dyer 1989 was not opened, so it is no longer cited for numbers. One institution: a lord's manorial court
whose offices are Settlement offices holding powers by `empower` laws, each power on the office the sources give it:

| Power | Office | Source |
|---|---|---|
| `levy` (taking pledges, distraining for rent and dues) | **beadle** | Bennett about p. 179 (`reeve-office`); in Maitland's rolls distraint is ordered by the court |
| `seize` (taking a holding into the lord's hand) | **beadle**, by the court's order | Bennett p. 179; Maitland: court-ordered distraint (one reeve seizure, Gidding p. 98, is noted, not followed) |
| `judge` (finding the judgment) | **suitors** (the homage) of the court | Maitland 1889 (`data/procedures/SOURCES.md`) |
| `present` (bringing offences to court), supervising labour, the yearly account | **reeve** | Bennett pp. 22, 172–175, 188–191 |

So the reeve keeps supervision, presentment and the account, not `levy`, `seize` or `judge`. Laws: a rent-in-kind
tax (variant A: fixed quantity, supported by Bennett's fixed tallage that "made no allowance for bad seasons", about
p. 141; variant B: proportional with remission in dearth, a **modelling assumption**, see D-demo-1), a theft
prohibition enforced by presentment (tithingmen or jurors present, the court amerces in money; `theft-presentment`),
and a duty of the lord to keep the granary (variant B only; a **modelling assumption**, see D-demo-2). The rent
amount itself is unsourced (`rent-in-kind` is null): it is a **modelling choice**, labelled in the fixture.

| D-row | Case | Behaviour | Status |
|---|---|---|---|
| D-demo-1 | Variant B rent remission in dearth | proportional rent with remission after a failed harvest, the experiment's treatment | **(unsourced)**, modelling assumption. Searched: Bennett 1937 to the end of the text, Maitland 1889 vol. 1 to the glossary, web search on the 1315 famine and manorial remission; only individual or office remissions and pardons for poverty found (`rent-remission-in-dearth`), nothing found for a dearth remission; Dyer 1989 and Homans 1941 not opened (3083: Dyer's archive.org page showed only site navigation; Homans not found on archive.org, 404). Question for Rex: keep variant B as a labelled counterfactual, or find a source (Dyer, Homans, a court roll). |
| D-demo-2 | Lord's duty to keep a granary for tenants | variant B only, a labelled duty law | **(unsourced)**, modelling assumption. Searched: Bennett 1937 to the end and its index, Maitland 1889 rolls to the glossary, web search on 1315 famine and manorial relief; nothing found (`lord-granary-duty`). Same question for Rex. |
| D-demo-3 | Reeve's powers in the earlier draft (`levy`, `seize`, `judge`) | reassigned as in the table above | sourced: Bennett gives distraint to the beadle, Maitland judgment to the suitors; the one reeve seizure (Gidding) is not general. |

The earlier sentence that "both forms are documented historically" is withdrawn: only variant A's fixed form is.

**Run:** five years daily; a harvest failure in year 3 from Economy's harvest (or a scripted *input* shock, clearly
marked as the experiment's treatment, not an outcome). Households are Cognition minds (baseline, null personality)
whose legitimacy beliefs about the court update from attributed experiences: what is left after the levy relative to
subsistence (Life's nutrition), thefts seen punished or not, seizures seen as fair or not.

**What must show (acceptance):**

1. Under variant A after the failure, the levy takes a larger share of what is left; beliefs `b_i` fall; payment
   breaches rise; seizures (Settlement `transfer` kind seizure) follow where enforcers comply; the beadle's backing
   falls as enforcers' own `y_j` falls; revenue (Settlement ledger) falls. **No number called legitimacy is ever
   incremented**; the trace shows each change as a belief update with its attributed cause.
2. Under variant B the same shock leaves `R` near its pre-shock level or raises it (relief attributed to the court).
3. Different seeds give different trajectories (which households fail, who is caught); the direction of the A–B
   difference holds across seeds or the demo reports that it does not.
4. Every coin and grain conserves (Settlement and Economy ledgers); every sanction is a command in the owners' logs.
5. The classifier labels the institution the same throughout (one lord's court): legitimacy moved, the "type" did not.

**Compliance in the baseline (Cognition keeper, 2026-10-31, C-G2):** until Society's norms exist, a mind decides to
pay, defy, report or enforce by expected consequences (Cognition C-Q6: no internalised norms); the `ought_obey`
belief does not yet weigh in the decision itself. So in this demonstration legitimacy beliefs move from experience
(the test of the P8 demonstration), backing `C` reads enforcers' `y_j` directly (§1.2), and payment breaches arise
from inability to pay and anticipated enforcement; the behavioural effect of legitimacy on compliance arrives with
Society's norms and is reported as not yet represented, never faked.

**What it needs:** Settlement (built), Economy (built: inventories, harvest), Cognition baseline (built: belief update,
attribution — needs an institution as a belief subject, to agree), Life labour and nutrition reads (partly built),
Society networks **stubbed** (witnessing by direct observation only; gossip later). This is why the demo is first:
every input exists but one interface.

### 3.1 Build units

Three codex units, in this order. All are Government-repo only and use the in-repo reads; wiring a real engine that
lives in another repo is not part of any (HANDOFF Blocked).

1. **Fixture.** `data/demo/manor.json`: the households (60: Bennett's average-village estimate,
   `households-per-village`, ch. IX p. 239; applying it to this manor is a modelling choice), the offices (lord, reeve, beadle,
   the suitors as a body) and the laws of both variants as law records that pass `checkLaws`: the `empower` laws of
   the power table above, variant A's fixed rent, variant B's proportional rent with remission (D-demo-1) and the
   granary duty (D-demo-2), and the theft prohibition citing the presentment procedure. Every number cites a
   `data/demo/SOURCES.md` slug or carries a `modelling choice` label; D-demo-1/2 laws carry `(unsourced)` notes.
   Loader `src/demo/fixture.ts` (loads, runs `checkLaws`, returns the variant's laws and households);
   test `test/demo-fixture.test.ts` (loads, every law passes, every number has a source slug or the label, the
   power table's office assignments hold). Reads used: none at run time; offices are Settlement-shaped records only.
2. **Run.** `src/demo/legitimacy-harvest.ts`: headless, seeded, five years daily, the year-3 harvest failure as a
   marked input shock, trace returned as data (belief updates with attributed cause, assessments, breaches,
   commands), never a legitimacy number. Test `test/demo-legitimacy-harvest.test.ts`: same seed same trace; the
   marked shock; every command routed to its owner provider; the daily grain balance; seed 42/43 R and backing
   printed as diagnostics (3087). The acceptance outcomes moved to unit 3. Reads and their providers:
   - Settlement offices, ledger and `transfer`: in-repo stub provider (the `AuthorityProvider` default and a
     fixture ledger), not the real Settlement engine.
   - Economy `economy.harvest`: in-repo stub (READS.md marks it stubbed), yields from `grain-yield`.
   - Cognition `BeliefReader.recognition` and household decisions to pay, defy or report: in-repo stub provider
     whose update rule is labelled a modelling stand-in, not the real Cognition baseline; until that is wired
     (HANDOFF Blocked) the demo reports its A–B result as stub-provider evidence, never as validation.
   - Life nutrition and `person.*` reads: in-repo stubs (READS.md), subsistence from `household-subsistence`.
   - Society witnessing: direct observation only, stubbed (§3 "What it needs").
3. **Acceptance (codex).** `test/demo-acceptance.test.ts`, plus any helper it needs under `src/demo/` (for example
   a per-seed summary of R, payment breaches and paid grain before and after the shock); src/ outside `src/demo/`
   and unit 2's run are not changed. Over the test's seed list, both variants on the same seed and the same
   shock: the A–B direction (per seed, B's post-shock R is at least A's and B's payment breaches at most A's;
   different seeds give different sets of breaching households); conservation of every grain and coin moved by
   command (each Economy `transfer` and Settlement `pay` command matches the stub ledger's change, grain closes as
   opening + harvested − consumed, coins moved equal the sum of commanded coin amounts, and every sanction in the
   trace is a command in the owner provider's log). What it asserts for each of §3's acceptance 1–5 is set below.

**Acceptance on the stub providers (5007):** 3087's trace (HANDOFF Gotchas) has variant B's R fall from about .99
to about .15 at the shock, so §3 acceptance 2 fails on the stub providers. That trace comes from the test host's
stub `updateBelief` (post-levy grain over annual need), a labelled modelling stand-in for Cognition, not the
Cognition baseline, so the failure says nothing yet about the institution; it is reported, never tuned away. Unit 3
treats §3's acceptance as follows:

| §3 acceptance | Unit 3 on the stub providers |
|---|---|
| 1. Variant A after the shock | **Asserts** R falls from its pre-shock day and payment breaches rise; every belief change is a belief update carrying its attributed cause; no legitimacy number is stored or incremented (R is recomputed from beliefs each day). **Reports** backing and revenue (lord's grain received) as stub-provider evidence only: backing reads one stub agent's belief. Seizures are **left to real-engine wiring**: the run infers no seizure (no title, recipient or amount is supplied) and the stub executes no Settlement `transfer` of kind seizure. |
| 2. Variant B keeps R near pre-shock | **Reports** B's pre- and post-shock R as stub-provider evidence, stating that it fails on the stub; the absolute level is **left to real-engine wiring** (real Cognition baseline). Only the A–B direction is asserted (row 3). |
| 3. Across seeds | **Asserts** the A–B direction on every listed seed and that seeds differ in which households breach. If the direction fails on a seed, the unit does not change seeds or parameters: the helper's summary names the seed, the test asserts that report, and HANDOFF records it. |
| 4. Conservation | **Asserts** grain and coin conservation and the command log as in unit 3 above, on the stub ledger. Conservation on the real Settlement and Economy ledgers is **left to real-engine wiring**. |
| 5. Classifier label unchanged | **Left to real-engine wiring**: no classifier is among the in-repo reads. Unit 3 asserts only that every trace day reads the same institution and domain and that no type field is written. |

The host choices the test may fix: the seed list (42 and 43 plus any further seeds it names), the shock size (90%
harvest loss, `shockMultiplier` 0.1), stores (none: household grain 0, granary 0), acres (5 per household), the
calendar (365-day years, harvest on day 0), the payment choice (pay available grain), and 3087's stub
`updateBelief`. **None of them is a sourced value**; the test labels them host modelling choices in its `note`, as
3087's does. Unit 3 must not retune the stub update rule, shock, stores or acres to make variant B pass, and adds no
constant presented as sourced. Every result on these providers is stub-provider evidence, never validation (§4);
§3 acceptance on real Settlement, Economy and Cognition stays in HANDOFF Blocked.

## 4. Validation plan (PLATFORM §11a, §11b)

| What | State to reach | Independent evidence | Tolerance |
|---|---|---|---|
| Law schema and evaluator | implemented, verified | 20 historical rules encode and give documented breaches | exact |
| Office powers via port | integrated with Settlement | thirty-day run byte-identical with default provider | exact |
| Tax through the ledger (P8 t1) | integrated | conservation; no household balance changes except by `pay` | exact |
| Legitimacy demo (§3) | integrated, direction validated | Scott 1976 / Levi 1988 direction; Tyler 1990 sign | sign and ordering, not magnitude |
| Contested succession (P8 t2) | integrated | Kokkonen & Sundell 2014 rate of contested successions by rule type | to be set from the data |
| Enclosure (P8 t3) | validated | Allen 1992 yields, employment, landholding shift | to be set |
| Polity formation (P8 t4, with P6) | integrated; seeds differ | Seshat polity size and hierarchy for H1, H2 (development) and H4 (held out) | P11 indicators I7, I8 |

Gates: mechanism tests per unit (predicate evaluation, breach stages, conservation of every sanction); integration
tests only when a port contract changes; Haiku check units that did not write the code; the registry keeper's
re-audit. A model that fails validation is investigated by this keeper, never tuned to pass.

## 5. Rex's decisions (GOV-Q, all Rex, 2026-10-31)

- **GOV-Q1 (Rex, 2026-10-31)** `A = f(J, R, C)` with first candidate `R · C/(C + C_opp)` is approved as a **provisional
  level-5 hypothesis**, in Rex's words: "Authority must be calculated from underlying causal mechanisms and observable
  conditions. Do not create an independently authoritative power score. Keep the initial formula explicitly
  provisional and subject to validation." Consequence for the build: `J`, `R`, `C`, `ω_i`, `κ_j`, `y_j` and `C_opp`
  are each computed on read from owned state (resources, enforcement capability, institutional recognition, social
  relationships, compliance records); `A` is never stored, never written, never an input to itself; `f` is a
  swappable function tagged `provisional`, and the demonstration reports it against alternatives.
- **GOV-Q2 (Rex, 2026-10-31)** The label vocabulary is the Catalogue's; History reads the label; Government exposes only
  the distribution.
- **GOV-Q3 (Rex, 2026-10-31)** The eight proposed rows (§1.8–§1.14) are approved: legitimacy aggregate, taxation,
  spending, property regime, collective choice, military organisation, polity structure, diplomacy.
- **GOV-Q4 (Rex, 2026-10-31)** One shared action-vocabulary contract row (`shared.action.kind`), registered through the
  registry keeper and owned by no engine.
- **GOV-Q5 (Rex, 2026-10-31)** A judge's mind decides contested predicates (open texture); the law stays crisp data and
  the procedure names the judge.
- **GOV-Q6 (Rex, 2026-10-31)** A Society norm becomes law only through a recognition event.
- **GOV-Q7 (Rex, 2026-10-31)** Battle-scale aggregation is a shared aggregation interface: Reality owns the physics,
  Government the decision.
- **GOV-Q8 (Rex, 2026-10-31)** The demonstration world is the English manor c. 1300.
