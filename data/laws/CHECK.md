# Law fixture check (2889)

Independent check of each `data/laws/<slug>.json` against its `## <slug>` section in `SOURCES.md` and, where the Source line gives a URL, one fetch of that page (2026-10-31). Reported only; nothing was changed.

merton-1235-c4-approvement-of-commons: mismatch: until 2006 is not supported; the fetched Commons Act 1236 page says chapter 4 was repealed for England and Wales in 1953 (Statute Law Revision Act 1953)
westminster-2-1285-c1-de-donis: ok
westminster-2-1285-c46-approvement: mismatch: added a fine sanction; SOURCES says the consequence is not stated and the fetched legislation.gov.uk entry gives no penalty
winchester-1285-hue-and-cry: ok
winchester-1285-watch-and-ward: ok
winchester-1285-arms-assize: mismatch: condition is `true`, dropping the wealth-based arms obligation (richest keep hauberk, helm, lance, knife, horse; under 40 shillings keep falchions and small arms) that SOURCES and the fetched Wikisource text both state
winchester-1285-highways: ok
mortmain-1279-de-viris-religiosis: ok
quia-emptores-1290: mismatch: added a fine sanction; SOURCES gives no fine and the fetched legislation.gov.uk text states no penalty (the consequence is a tenure change)
assize-of-bread-and-ale-c1266: ok
forest-charter-1217-venison: ok
forest-charter-1217-common-and-agistment: ok
ordinance-of-labourers-1349-service: mismatch: hiring or keeping a worker who left service is recorded as a fine; SOURCES and the fetched Wikipedia page say imprisonment
ordinance-of-labourers-1349-almsgiving: ok
statute-of-labourers-1351-wages: ok
statute-of-labourers-1351-oath-and-stocks: ok
treason-1351: ok
diet-and-apparel-1363-yeomen-and-servants: mismatch: added a fine sanction; SOURCES says the consequence and enforcement are not stated, and the fetched Wikipedia page gives no penalty
frankpledge-tithing-duty: mismatch: from 1215 is not supported; SOURCES says in force before 1215, and the fetched Wikipedia page does not mention 1215
gleaning-bylaw: unverifiable: the textbook excerpt (digfir-published.macmillanusa.com) did not resolve (DNS error); the lahs.org.uk page fetched does not state who may glean or the fine, so the eligibility rule could not be checked
sheaves-payment-bylaw-broughton-1286: unverifiable: the textbook excerpt URL did not resolve (DNS error); matches SOURCES (4d to the lord) but the source page could not be read
heriot: mismatch: from 1215 is not supported; SOURCES says before 1215. The fetched Nottingham glossary does not state "best beast" (the JSON's note relies on the Oxford summary, which was not fetched)
merchet: mismatch: from 1215 is not supported; SOURCES says before 1215
suit-of-mill: mismatch: from 1215 is not supported (SOURCES gives no start date); a fine sanction is added although SOURCES says the consequence is not stated; no source URL to fetch
forestalling-regrating: ok

Result: fail (10 mismatches)
