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
  issuer: AuthorityId                    // the office or body whose rule-making power made it (§1.3)
  enactment: EventId                     // the event of making it, under a procedure (§1.3); the law's provenance
  modality: 'prohibit' | 'require' | 'permit' | 'empower' | 'establish'
  //   prohibit/require/permit: primary rules on conduct (Hart 1961)
  //   empower: confers a power on an office: "the reeve may seize", "the council may levy" (Hart's power-conferring rules)
  //   establish: creates an office or body (the record is Settlement's createOffice; the rule that it exists is here)
  jurisdiction: {
    authority: AuthorityId               // whose jurisdiction (§1.6); several laws from rival authorities may cover one act
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

### 1.11 Property-rights regimes (`government.property.regime`, **proposed new row**)

A regime is the set of laws over Settlement's title and lease commands: which title classes may exist, whether and to
whom they transfer (`transferable`), inheritance rules (SET-11), commons and access rights, enclosure, entail,
seizure grounds. Settlement keeps the titles and executes the commands; Government's laws decide whether a command is
lawful (`void` consequence: an unlawful sale does not transfer) and Settlement's `transferable` field becomes a read
of the regime when Government is present (§2.3). Test: ROADMAP P8 t3, the same society under open fields vs enclosure
diverges as the sources describe (Allen 1992, *Enclosure and the Yeoman*; Clark 1998, "Commons sense"; level 3).

### 1.12 Collective choice procedures (`government.collective_choice.procedure`, **proposed new row**)

When a body rather than a person decides (a council, an assembly, an electorate, a jury), the procedure aggregates
the members' individual intentions (Cognition) into one decision: who may vote, weights, quorum, threshold, agenda,
order. Data, executed exactly; strategic voting and coalition-making are the members' minds. Evidence: social choice
is level 1 for what a rule does with given ballots (Arrow 1951; May 1952); level 3 for which rules real bodies used.
Consumers: rule creation, succession by election, war declaration by a council, treaty ratification.

### 1.13 Military organisation (`government.military.organisation`, **proposed new row**)

An armed force is an organisation (Society's actor record, DUP-58 watch) under an office holding `command` and
`levy` powers: recruitment rules (feudal levy, paid troops, conscription, militia: `require` and `empower` laws),
pay and supply (Economy goods, Settlement ledger), command structure (a delegation tree, §1.2), discipline (laws with
enforcers inside the force). Its **capacity** `C` is a read: persons (Life), equipment (Economy), supply on hand,
loyalty (`y_j`). Fighting is Reality and Life (P2 demonstration: two fighters); at battle scale an aggregation
interface is needed (Lanchester 1916 equations as a level-4 aggregate, explicitly an approximation of many resolved
contests; Rex, 2026-10-31, GOV-Q7: a shared aggregation interface, Reality the physics, Government the decision). Tilly (1990) war-makes-states feedback arises from tax (§1.9)
funding force (§1.13) enforcing tax.

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

**World (proposed fixture; every number labelled; historical first):** one village of ~60 households modelled on a
documented English manor c. 1300 (Bennett 1937 *Life on the English Manor*; Dyer 1989 *Standards of Living in the
Later Middle Ages* for grain yields and subsistence per household, level 3). One institution: a lord's manorial court
with a reeve (Settlement office) holding `levy`, `seize` and `judge` powers by `empower` laws. Laws: a rent-in-kind
tax (variant A: fixed quantity; variant B: proportional with remission in dearth — both forms are documented
historically), a theft prohibition enforced by the reeve with a presentment-jury procedure, and a duty of the lord to
keep the granary (variant B only).

**Run:** five years daily; a harvest failure in year 3 from Economy's harvest (or a scripted *input* shock, clearly
marked as the experiment's treatment, not an outcome). Households are Cognition minds (baseline, null personality)
whose legitimacy beliefs about the court update from attributed experiences: what is left after the levy relative to
subsistence (Life's nutrition), thefts seen punished or not, seizures seen as fair or not.

**What must show (acceptance):**

1. Under variant A after the failure, the levy takes a larger share of what is left; beliefs `b_i` fall; payment
   breaches rise; seizures (Settlement `transfer` kind seizure) follow where enforcers comply; the reeve's backing
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
