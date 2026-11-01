# Harvest host sensitivity (GOV-16)

Reproduce with `npx --yes --cache .codex-runs/npm-cache tsx scripts/demo-sensitivity.ts` (tsx is needed because the kernel dependency ships TypeScript). Five years daily, variants A/B, seeds 42/43. Stub-provider evidence only, not engine or historical validation. No laws, belief rule, payment rule, acres, or other host settings were tuned.

## Inputs and measurements

Recorded [harvest-loss-1315](SOURCES.md#harvest-loss-1315) Value: grain yield as a fraction of the 1211–1491 average, all English grain together: 1315 about 0.61 (39 % below), 1316 about 0.37 (63 % below), 1317 about 0.90 (10 % below). A second summary of the same Campbell work gives wheat and rye about 0.60 in 1315 (40 % below) and about 0.40 in 1316 (60 % below), and says 1321 was as bad as 1315. No per-crop split, estate or county is given in either; both are rounded national figures.

The sourced multipliers retain that fraction of normal harvest; 0.1 is the unsourced 90% loss baseline. The sourced figures are rounded national summaries from secondary accounts of Campbell, not manor-specific measurements. Each is applied separately to the single year-3 shock, not as a consecutive 1315–17 sequence.

Recorded [peasant-grain-stores](SOURCES.md#peasant-grain-stores) Value: null. Only zero initial household stores and zero initial granary grain are tested; neither is sourced. Stocks can accumulate during the run. No sourced storage conclusion is available.

R and backing C are read on days 729 → 730 (immediately before → on the shock). Payment breaches and paid grain compare harvest deadlines 365 → 730. Grain columns are household totals and lord-granary balances at day end, after daily consumption, on days 729 → 730; all grain is in bushels. R and C are computed reads, not stored meters. Backing uses the same single stub agent as the existing demo.

Other unchanged unsourced host choices: five 365-day years, harvest day 0, five acres per household, initial belief/weight/capacity 1, pay available grain, one scripted observed theft on the shock day, and the food-adequacy Cognition callback. Yield and annual need use the fixture ranges; uniform sampling remains a modelling stand-in.

## shockMultiplier 0.1

shockMultiplier = 0.1: stub (unsourced); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.000000 | 0 → 60 | 0.871731 → 0.000000 | 480.000000 → 255.910723 | 0.585704 → 0.000000 | 960.000000 → 1215.910723 |
| B | 42 | 0.987294 | 0.153713 | 0 → 0 | 0.971003 → 0.108418 | 255.798186 → 0.000000 | 92.557555 → 341.634410 | 509.751871 → 509.751871 |
| A | 43 | 0.915583 | 0.000000 | 0 → 60 | 0.932899 → 0.000000 | 480.000000 → 254.653512 | 0.087572 → 0.000000 | 960.000000 → 1214.653512 |
| B | 43 | 0.990471 | 0.166013 | 0 → 0 | 1.000000 → 0.194366 | 256.024026 → 0.000000 | 120.068502 → 368.401245 | 513.469046 → 513.469046 |

## shockMultiplier 0.61

shockMultiplier = 0.61: sourced (harvest-loss-1315); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.473074 | 0 → 0 | 0.871731 → 0.454189 | 480.000000 → 480.000000 | 0.585704 → 1071.820154 | 960.000000 → 1440.000000 |
| B | 42 | 0.987294 | 0.725133 | 0 → 0 | 0.971003 → 0.661350 | 255.798186 → 0.000000 | 92.557555 → 1643.792005 | 509.751871 → 509.751871 |
| A | 43 | 0.915583 | 0.472027 | 0 → 0 | 0.932899 → 0.500782 | 480.000000 → 480.000000 | 0.087572 → 1066.706613 | 960.000000 → 1440.000000 |
| B | 43 | 0.990471 | 0.737189 | 0 → 0 | 1.000000 → 0.793857 | 256.024026 → 0.000000 | 120.068502 → 1666.687544 | 513.469046 → 513.469046 |

## shockMultiplier 0.37

shockMultiplier = 0.37: sourced (harvest-loss-1315); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.204170 | 0 → 0 | 0.871731 → 0.193986 | 480.000000 → 480.000000 | 0.585704 → 459.040109 | 960.000000 → 1440.000000 |
| B | 42 | 0.987294 | 0.456229 | 0 → 0 | 0.971003 → 0.401147 | 255.798186 → 0.000000 | 92.557555 → 1031.011961 | 509.751871 → 509.751871 |
| A | 43 | 0.915583 | 0.203238 | 0 → 0 | 0.932899 → 0.218669 | 480.000000 → 480.000000 | 0.087572 → 455.748355 | 960.000000 → 1440.000000 |
| B | 43 | 0.990471 | 0.468400 | 0 → 0 | 1.000000 → 0.511744 | 256.024026 → 0.000000 | 120.068502 → 1055.729286 | 513.469046 → 513.469046 |

## shockMultiplier 0.9

shockMultiplier = 0.9: sourced (harvest-loss-1315); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.797999 | 0 → 0 | 0.871731 → 0.768602 | 480.000000 → 480.000000 | 0.585704 → 1812.262708 | 960.000000 → 1440.000000 |
| B | 42 | 0.987294 | 0.988358 | 0 → 0 | 0.971003 → 0.975763 | 255.798186 → 24.135830 | 92.557555 → 2360.098729 | 509.751871 → 533.887701 |
| A | 43 | 0.915583 | 0.796813 | 0 → 0 | 0.932899 → 0.841669 | 480.000000 → 480.000000 | 0.087572 → 1804.947842 | 960.000000 → 1440.000000 |
| B | 43 | 0.990471 | 0.984587 | 0 → 0 | 1.000000 → 1.000000 | 256.024026 → 44.249792 | 120.068502 → 2360.678980 | 513.469046 → 557.718838 |

## shockMultiplier 0.6

shockMultiplier = 0.6: sourced (harvest-loss-1315); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.461869 | 0 → 0 | 0.871731 → 0.443348 | 480.000000 → 480.000000 | 0.585704 → 1046.287652 | 960.000000 → 1440.000000 |
| B | 42 | 0.987294 | 0.713928 | 0 → 0 | 0.971003 → 0.650509 | 255.798186 → 0.000000 | 92.557555 → 1618.259504 | 509.751871 → 509.751871 |
| A | 43 | 0.915583 | 0.460827 | 0 → 0 | 0.932899 → 0.489027 | 480.000000 → 480.000000 | 0.087572 → 1041.250019 | 960.000000 → 1440.000000 |
| B | 43 | 0.990471 | 0.725989 | 0 → 0 | 1.000000 → 0.782103 | 256.024026 → 0.000000 | 120.068502 → 1641.230949 | 513.469046 → 513.469046 |

## shockMultiplier 0.4

shockMultiplier = 0.4: sourced (harvest-loss-1315); granaryGrain = 0: stub (unsourced); household initial grain = 0: stub (unsourced)

| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |
|---|---|---|---|---|---|---|---|---|
| A | 42 | 0.911965 | 0.237783 | 0 → 0 | 0.871731 → 0.226511 | 480.000000 → 480.000000 | 0.585704 → 535.637615 | 960.000000 → 1440.000000 |
| B | 42 | 0.987294 | 0.489842 | 0 → 0 | 0.971003 → 0.433672 | 255.798186 → 0.000000 | 92.557555 → 1107.609466 | 509.751871 → 509.751871 |
| A | 43 | 0.915583 | 0.236837 | 0 → 0 | 0.932899 → 0.253933 | 480.000000 → 480.000000 | 0.087572 → 532.118138 | 960.000000 → 1440.000000 |
| B | 43 | 0.990471 | 0.501999 | 0 → 0 | 1.000000 → 0.547008 | 256.024026 → 0.000000 | 120.068502 → 1132.099068 | 513.469046 → 513.469046 |

## Verdict

B holds or rises relative to its own pre-shock R in 1/10 sourced-harvest runs; it stays strictly above A at the shock in 10/10. The sourced harvest inputs do not consistently preserve B’s pre-shock R: the failure remains, though its size depends on harvest severity. No tolerance for “near” was invented: the tables give the actual change for assessing §3 item 2. This checks the immediate shock, not a guarantee about all subsequent years.

At the mildest sourced shock (multiplier 0.9), B’s R is seed 42: 0.987294 → 0.988358; seed 43: 0.990471 → 0.984587. These are small changes around the pre-shock level, unlike the large declines at the more severe sourced shocks; a strict hold-or-rise count should not be confused with declaring every decrease a collapse.

For A under sourced shocks, payment breaches rise in 0/10 runs and paid grain falls in 0/10. Thus the full §3 item 1 chain is not reproduced merely by using sourced harvest losses, even though A’s R declines.

The A–B comparison addresses the requested direction alongside §3 items 1–2, not full acceptance: seizures and real-engine behaviour remain outside this experiment. B’s laws are labelled level-5 counterfactuals (PLATFORM §4): D-demo-1 is proportional rent with dearth remission; D-demo-2 is the lord’s granary duty. Neither is established historical practice by the recorded sources.

The mechanism is the unchanged host Cognition callback: it replaces each observed belief with min(1, post-levy household grain / annual subsistence). It does not smooth with the previous belief, and even a fully remitted rent (paid 0) can leave too little food for that ratio to hold. The trace attributes that food adequacy to the court. The granary keeps collected grain, but the provider records “Granary quantity/deadline/remedy unspecified; no relief inferred”; the duty alone sends no grain back to households. Theft/punishment observations do not enter this callback’s formula. Thus a milder shock can reduce the collapse without supplying the missing relief mechanism.

## Attributed trace evidence

Each entry quotes the recorded cause for the first household (also the backing agent), with the last pre-shock update at day 365 and the shock update at day 730. Falling-belief counts cover all 60 households. These are trace records, not inferred motives.

- B, seed 42, multiplier 0.1 (stub (unsourced)), household.manor-01: 60/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.108418: `Cognition stub: post-levy grain 4.186813643202186 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.1 (stub (unsourced)), household.manor-01: 60/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 0.194366: `Cognition stub: post-levy grain 7.190199982957162 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
- B, seed 42, multiplier 0.61 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.661350: `Cognition stub: post-levy grain 25.53956322353333 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.61 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 0.793857: `Cognition stub: post-levy grain 29.367242386902394 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
- B, seed 42, multiplier 0.37 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.401147: `Cognition stub: post-levy grain 15.491210479848087 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.37 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 0.511744: `Cognition stub: post-levy grain 18.93098713798699 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
- B, seed 42, multiplier 0.9 (sourced (harvest-loss-1315)), household.manor-01: 13/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.975763: `Cognition stub: post-levy grain 37.68132278881967 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.9 (sourced (harvest-loss-1315)), household.manor-01: 18/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 1.000000: `Cognition stub: post-levy grain 41.97771747934184 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
- B, seed 42, multiplier 0.6 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.650509: `Cognition stub: post-levy grain 25.120881859213114 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.6 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 0.782103: `Cognition stub: post-levy grain 28.932398418197586 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
- B, seed 42, multiplier 0.4 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 0.971003: `Cognition stub: post-levy grain 37.49749465822242 / annual subsistence 38.61729620303959; paid 4.166388295358047 attributed to court`. Day 730, belief 0.971003 → 0.433672: `Cognition stub: post-levy grain 16.747254572808743 / annual subsistence 38.61729620303959; paid 0 attributed to court`.
- B, seed 43, multiplier 0.4 (sourced (harvest-loss-1315)), household.manor-01: 60/60 beliefs fall. Day 365, belief 1.000000: `Cognition stub: post-levy grain 39.83486214885495 / annual subsistence 36.99310185294598; paid 4.251082704169676 attributed to court`. Day 730, belief 1.000000 → 0.547008: `Cognition stub: post-levy grain 20.235519044101416 / annual subsistence 36.99310185294598; paid 0 attributed to court`.
