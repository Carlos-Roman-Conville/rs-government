# Demo sources: the English manor c. 1300

Reference data for the DESIGN §3 demonstration (`demo/legitimacy-harvest`). One slug-named `##` section per fact.
Everything is paraphrased. Read 2026-11-01 through a text-extraction tool over the archive.org full-text scan of
Bennett, *Life on the English Manor* (1937; item `lifeontheenglish020976mbp`), in 100,000-character chunks covering
roughly pp. 1–267 of a book of about 330 pages; printed page numbers are approximate (the scan has no page markers,
the tool inferred them from the contents list) and the last ~225,000 characters (about pp. 267 to the end) were
**not** read. Maitland's Introduction (Selden Society vol. 1, 1889) was read for its first 100,000 characters only.
Dyer 1989 (`standardsoflivin0000dyer`) returned HTTP 401, Homans 1941 (`englishvillagers0000homa`) returned HTTP 403
and the `…unse` copy returned no book text, so **neither was opened**. Where a field says "not stated in the
source", the passages read did not give it; it does not mean the rule or figure did not exist. A `null` is not a
claim that nothing exists.

## households-per-village
- Value: 60 households
- Place and period: England, 1150–1400 generally (Bennett's span); no single manor.
- Source: Bennett 1937, ch. IX "Everyday Life", p. 239 (index: "Village, size of average English, 240"), https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note (5006): checked in the full text; Bennett, ch. IX p. 239, in estimating population growth, supposes the average English village to be about 300 souls, i.e. some 60 families. This is his own assumption, not a count; 3083's locator (ch. II about p. 39, and "about p. 240") was loose: the sentence is on p. 239, and the index points to pp. 239–240.
- Note (3083): read on after p. 267, Bennett ch. IX, about p. 240, calls the average English village about 300 souls, roughly 60 families; this is his own estimate and he gives no household count per manor. Maitland 1889 vol. 1, Introduction p. 4, gives single manors only: Swincombe ten customary tenants with eight acres each plus eleven cottars; Cottisford five freeholders, fifteen villani and one cottar.
- Note (5051, context only, not the Value): single-manor counts, not an average: Ashfield Magna, 35 joint tenures; Martham, 68 to 107 tenants (Bennett, about p. 50). They show how far one manor can sit from the 60 estimate.
- Searched (3083): Bennett to the end of the text (about p. 365, index); Maitland 1889 full text to the glossary; Dyer 1989 archive.org page returned only site navigation; Homans 1941 not found on archive.org (404), search showed only catalogue records and a restricted Fulcrum edition.
- Searched: Bennett 1937 pp. 1–267 (ch. I–VIII and the start of IX); Homans 1941 (earlier attempt: full text blocked, HTTP 403, not opened; 3083 later got 404); web search for a Hundred Rolls households-per-village average (returned catalogue pages only).

## rent-in-kind
- Value: null
- Place and period: manors of the 13th–14th centuries named by Bennett (e.g. Hales, Ramsey and Chichester estates).
- Source: Bennett 1937, ch. V "Rents and Services" and ch. VI "Servile Burdens" (about pp. 97–152), https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: no quantity of grain rent per household or per holding was found in the pages read. Documented in-kind items: a hen or some eggs taken to the manor house at set seasons (about p. 99); a yearly wood-penny (money, about p. 99); mill multure, one thirteenth of the grain for the serf against one twenty-fourth for the free (about p. 133); heriot on death sometimes paid as an ox, a cow or sheaves of corn (Hales, about p. 148); tallage assessed on a serf's land and number of animals (about p. 141). Most of a villein's rent was labour (week-work and boon-work), which the demonstration would have to convert to grain; no such conversion is given. Both variants in DESIGN §3 therefore rest on documented forms but not on a sourced amount.
- Searched (3083): Bennett pp. 267–end (ch. IX–XI, glossary, index): no general grain rent; the only grain amounts are a Hales widow's maintenance agreement of a quarter of wheat, a quarter of oats and a bushel of peas (about p. 253), which is a provision for a retired tenant, not a rent. Maitland 1889 court rolls: grain appears only as a church-building payment of one garb of wheat per house (Graveley, p. 150), not a rent. Dyer and Homans: no usable text (see header). Value stays null.
- Searched: Bennett 1937 chapters V–VII in full (chunks at 200,000 and 300,000 characters); Dyer and Homans not opened (see header).

## rent-remission-in-dearth
- Value: null
- Place and period: Bennett's manors, 13th–14th centuries.
- Source: Bennett 1937, about pp. 106, 141, 176, 180, 230, https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: a general remission of rent after a bad harvest is **not stated in the source** pages read. What Bennett does give: a fixed tallage "made no allowance for bad seasons" (about p. 141), which supports variant A; works could be excused or sold to the peasants when the lord did not need the labour (about p. 106); rent lowered for a tenant's ruinous cottage (about p. 230) and timber granted for repair; remission of rent as a perquisite of the reeve (all, half, or five shillings, about p. 176), the hayward (p. 180) and the famuli (p. 183); an adultery amercement forgiven on the Ramsey manors (about p. 246). These are individual or office-based remissions, not a dearth relief, so variant B's "proportional with remission" is not shown to be documented by these pages. Flag for Rex: DESIGN §3 says both forms are documented historically.
- Searched (3083): Bennett pp. 267–end and Maitland 1889 rolls, no dearth remission found. Maitland gives individual forgiveness: amercements forgiven or respited because the person was poor (Ruislip 1291, p. 42; Broughton 1258, p. 52; Hemingford and Gidding, pp. 89–98; "condonatur quia pauper", pp. 114, 121), and half-mark and other fines "forgiven by the Abbot" (Elton, p. 72). One footnote calls the time of a 1277 Welsh-war service rate "little short of famine" (p. 62) but grants no relief. Bennett p. 191: a bad year led to increased demands and tighter conditions. Dyer and Homans: no usable text. Value stays null.
- Searched: Bennett 1937 pp. 1–267; a web search on 1315 famine and manorial remission (returned general famine pages, no manor-level remission); Dyer and Homans not opened.

## grain-yield
- Value: 8–9 bushels per acre (Bennett's "conservative" estimate; 10 "possibly not too high"), with sowing about 2 bushels per acre, i.e. a return of about four times the seed.
- Place and period: England, 13th century; the Winchester estate figures are for 1200–1250.
- Source: Bennett 1937, ch. IV (about p. 86), https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: Bennett cites Beveridge's Winchester average of about 9.44 bushels per acre for 1200–1250, Rogers's judgment that the increase was "not more than four times", and Walter of Henley's rule that land returning three times the seed profited the owner nothing unless corn was dear. The sources differ (3 to 4 times seed; 8 to 10 bushels); the fixture should take the range, not one number. Dyer's yields were not opened.
- Searched: Bennett 1937 pp. 44–89 (chunk from 100,000 characters); Dyer 1989 full text (HTTP 401).

## household-subsistence
- Value: 36–40 bushels of corn per household per year (a family of five or six); equivalently about 4–5 quarters of wheat for five persons (a quarter is eight bushels).
- Place and period: England, 13th–14th centuries (the per-person quarter is an 18th-century figure that Bennett applies backwards).
- Source: Bennett 1937, ch. IV, about pp. 88 and 96, https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: Bennett puts a family's need at 36–40 bushels, to be grown on a holding of five to ten acres (p. 96). He also says roughly one quarter of wheat per person per year, "from eighteenth-century England" (p. 88), and that ploughmen and carters were paid about one quarter of corn every ten or twelve weeks, 29–36 bushels a year (p. 88). At 8–9 bushels per acre (see `grain-yield`), 36–40 bushels takes four to five acres of crop before seed is set aside, which is why the holding is larger. Dyer's own subsistence model, which DESIGN names, was not opened; a web search for it found only a review and catalogue pages, and a forum post about virgate sizes that is not used.
- Searched: Bennett 1937 pp. 44–135; Dyer 1989 (HTTP 401); web search for Dyer's peasant grain figures (no figure found).

## reeve-office
- Value: null
- Place and period: Bennett's manors, 13th–14th centuries (Staplegrove, Battle, Hales and others named).
- Source: Bennett 1937, ch. VII "Manorial Administration", about pp. 169–192, https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: how chosen: sometimes appointed outright by the lord, elsewhere elected by the peasants, sometimes with lordly approval; men at Staplegrove paid to elect their own reeve (about p. 170); at one Battle-area manor tenants refused the office in protest (about p. 171). Powers: wide authority over daily labour, "the chief of the peasants for the time being" (about p. 173); he watched the threshers against waste and theft (about p. 172); he presented offences to the court (Prologue, about p. 22). Accountability: he presented the yearly account, was checked by auditors against earlier rolls and held strictly responsible for any debt (about pp. 188–191); concealment was fined (about p. 175). Taking pledges and levying distresses is described for the **beadle**, not the reeve (about p. 179); a power of the reeve to levy a rent or distrain is **not stated in the source** pages read. DESIGN §3 gives the reeve `levy`, `seize` and `judge`; these pages support supervision and presentment, not judging, which Maitland assigns to the suitors (see `data/procedures/SOURCES.md`).
- Note (3083): Maitland's rolls add that the steward chose a reeve from the best men of the vill and the man later paid 40s. to be released (Brightwaltham, p. 168); reeves paid to leave office (Bledlow 1275–6, 6s. 8d., p. 23; Ruislip 1296, a mark, p. 45, with the order that it be levied); a vill was amerced for electing a reaper without presenting him to the bailiff (Ogbourne 1290, p. 36); at Gidding the reeve seized a cottage into the lord's hand and locked it (p. 98), which is the one seizure by a reeve found; a reeve was himself ordered distrained for releasing impounded beasts (Elton, p. 73). Distraint is otherwise ordered by the court. Bennett p. 301: a bailiff forced a man to serve as reeve. A reeve's own power to levy a rent is still not stated in the source.
- Searched (3083): Bennett to the end; Maitland 1889 vol. 1 full text to the glossary; Homans and Dyer: no usable text.
- Searched: Bennett 1937 pp. 1–267 (ch. VII fully); Maitland 1889 Introduction pp. xxii–xxxvi; Homans 1941 not opened.

## lord-granary-duty
- Value: null
- Place and period: none found.
- Source: Bennett 1937, searched pp. 1–267, https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: a lord's duty to keep a granary or to feed tenants in famine is **not stated in the source** pages read. The only storage-related point seen is the lord's own barn and granary under the reeve's account. Variant B's duty is therefore a modelling assumption, to be marked as such in the fixture, not a historical rule.
- Searched (3083): Bennett pp. 267–end (no granary entry; index has only forced hospitality given to the lord, pp. 142–143, 161, 165); Maitland 1889 rolls to the glossary (no granary or famine feeding); Dyer and Homans: no usable text. Value stays null.
- Searched: Bennett 1937 pp. 1–267, all chunks queried for famine relief and granary; Dyer and Homans not opened; web search on 1315 famine and manorial relief (general famine pages only); the last ~225,000 characters of Bennett (about pp. 267–end, ch. X onward) not read.

## theft-presentment
- Value: null
- Place and period: England, 13th century; the sheriff's tourn and leet machinery as described by Maitland from Fleta and Britton (late 13th century).
- Source: Maitland 1889, *Select Pleas*, vol. 1, Introduction (about pp. xxv–xxxvi), https://archive.org/stream/selectpleasinman00mait/selectpleasinman00mait_djvu.txt ; Bennett 1937, ch. VIII (about pp. 196–198, 231), https://archive.org/download/lifeontheenglish020976mbp/lifeontheenglish020976mbp_djvu.txt
- Note: theft came to a court by presentment, not a private plaint: the chief pledges, tithings or township first report, and a jury of twelve then adopts or corrects the report (about pp. xxix–xxx); the Assize of Clarendon required such an inquiry for robbers and thieves (about pp. xxxi–xxxii). Felony indictments could not be tried in a leet (about p. xxviii). A lord holding infangthief could hang a thief taken on his land (about p. xxv), and Bennett notes that this right was bounded, e.g. needing the coroner (pp. 196–198, the 1313 Bodmin rebuke). No specific penalty for ordinary theft in a manorial court is stated in the Introduction; wood-cutting without leave is ranked with theft and bloodshed in the Ramsey customal (Bennett, about p. 231). Whether a village-level theft reached the manor court by the reeve is **not stated in the source** pages read.
- Note (3083): the rolls show theft handled by presentment and suit: tithingmen reported thefts at the Whorwelsdown hundred court, 1262 (pp. 181–182), and jurors presented wool stolen from a fold, with the thief amerced (p. 180); jurors fined a man 6d. for wrongly keeping a garb of wheat taken from another's land (Hemingford, p. 88) and a woman 6d. for taking a sheet (Gidding, p. 98); Swincombe 1246, two men amerced 6s. 8d. each for the lord's wood "thievishly carried away" (p. 7); the township suspected two men of larceny (Weedon Beck 1247, p. 11); private accusations also appear, one settled for half a sextary of wine with a 12d. amercement (Ogbourne 1249, p. 20). Bennett pp. 196–198: tithingman presented a thief who was hanged. Penalties in the rolls read are money amercements. Whether the reeve carried a village theft to the manor court is not stated in the source.
- Searched (3083): Maitland 1889 rolls to the glossary; Bennett to the end; Homans and Dyer: no usable text.
- Searched: Maitland 1889 Introduction (first 100,000 characters; the rolls themselves were not reached); Bennett 1937 pp. 196–231; Homans 1941 not opened.
