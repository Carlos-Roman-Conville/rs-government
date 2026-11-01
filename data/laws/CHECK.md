# Law fixture check (2903, after fixes 2901 and 2902)

Independent re-check of each `data/laws/<slug>.json` against its `## <slug>` section in SOURCES.md, and the
Source URL fetched once (WebFetch, 2026-11-01). Report only; nothing fixed here.

Notes on fetch limits: the Wikipedia pages were fetched as summaries; c.4 of Merton, the Winchester chapters and
the Westminster II chapters were checked against summaries, not the chapter text. The Broughton textbook URL in
the sheaves JSON no longer resolves (DNS failure), and the Wymeswold/Islip page does not support the gleaning
eligibility list.

merton-1235-c4-approvement-of-commons: ok
westminster-2-1285-c1-de-donis: ok
westminster-2-1285-c46-approvement: ok
winchester-1285-hue-and-cry: ok
winchester-1285-watch-and-ward: ok
winchester-1285-arms-assize: mismatch: condition is `true` (all keepers of arms, ages 15-60), but SOURCES.md and the fetched Statute of Winchester summary make the duty depend on wealth (hauberk, helm, lance and horse for the richest; small arms for those under 40 shillings a year); the wealth tiers are missing
winchester-1285-highways: ok
mortmain-1279-de-viris-religiosis: ok
quia-emptores-1290: ok
assize-of-bread-and-ale-c1266: mismatch: from is the exact year 1266, but SOURCES.md gives only "c. 1266" (exact date not stated) and the fetched Wikipedia article gives only the 13th-century tag; the exact year is not supported
forest-charter-1217-venison: ok
forest-charter-1217-common-and-agistment: ok
ordinance-of-labourers-1349-service: ok
ordinance-of-labourers-1349-almsgiving: ok
statute-of-labourers-1351-wages: ok
statute-of-labourers-1351-oath-and-stocks: ok
treason-1351: ok
diet-and-apparel-1363-yeomen-and-servants: unverifiable: the class limits and persons list rest on a search summary; the fetched Wikipedia article gives no class limits, no covered persons and no penalties, so the JSON's person list cannot be checked against it
frankpledge-tithing-duty: ok
gleaning-bylaw: unverifiable: the eligibility condition (elderly, small children, ill) and the c.1286 start come from a textbook excerpt that SOURCES.md says has no working source; the fetched Wymeswold/Islip page gives no eligibility list and does not mention 1286
heriot: ok
merchet: ok
suit-of-mill: unverifiable: SOURCES.md has no source with this rule's content and no URL; nothing could be fetched
forestalling-regrating: ok
sheaves-payment-bylaw-broughton-1286: unverifiable: the Source URL does not resolve (DNS failure); SOURCES.md says the rule and the 4d amount are carried over from a dead textbook excerpt and not confirmed by a working source

Result: fail (2 mismatches)
