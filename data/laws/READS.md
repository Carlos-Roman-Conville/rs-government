act.adhering-rebels-not-enemies — Courts' reading that adhering to rebels or pirates is not adhering to the king's enemies.
act.overt-proved — An overt act of treason is proved as the courts require.
apparel.above-rank-limit — Apparel exceeds the sumptuary limit for the wearer's rank class.
common.sufficient-for-neighbours — Enough common pasture remains for neighbouring commoners after enclosure.
common.sufficient-for-tenants — Enough common pasture remains for the lord's freehold tenants' holdings.
daughter.marries — A villein tenant's daughter marries.
day.in — Calendar window for when a rule applies (season, feast bounds, or post-enactment date).
felony.or-robbery-done — A felony or robbery has been committed triggering hue and cry.
gift.after-statute — A conditional gift was made after the De donis statute.
gift.before-statute — A conditional gift was made before the De donis statute.
gift.colour-of-pity — A gift is made under the colour of pity or alms.
gift.conditional — Land was given with a condition in the deed.
holds.permission — Whether an actor holds a named permission or franchise (fee simple, forest leave, suit of mill, etc.).
kin.children — Society (stubbed): direct child IDs of act.object at act.day; [] is a known empty family, null is unknown. Succession uses act.actor=outgoing holder, act.action=succeed, act.object=holder, act.place=host-supplied office place, attempted=false and succeeded=false. Subsequent person reads use act.object=child with the same context. Law predicates instead use act.object=office ID.
law.empowered-actors — Current recipient actor IDs of an empower law, resolved by the host from its predicates and owned office membership. For delegation reads, act.actor is the issuer, act.object is the law ID, act.action is the grant's action, act.day is the query day and act.place is empty. Return an array (empty when there are no recipients); missing or invalid values fail explicitly. Government filters status, dates and supersession before this read.
member.fled — A summoned tithing member has fled.
member.suspected-and-summoned — A tithing member is suspected of crime and summoned.
object.kind — Kind of object or land involved in the regulated act.
person.accustomed-to-forest-common — Person is accustomed to common in the royal forest.
person.able-bodied — Person is able-bodied for labour or alms rules.
person.age — Person's age in years.
person.alive — Life (stubbed): boolean living status of act.object at act.day; null is unknown. Only living children enter primogeniture.
person.born — Life (stubbed): finite birth day of act.object in the host's query-day epoch; null is unknown. Earlier means older; equal days retain multiple claims without an invented tie-break.
person.gleaning-eligible — Person is among the poorest entitled to the customary gleaning right described in SOURCES.md. A general eligibility threshold is not stated in the source; do not infer age, health or a universal wage test from the later local by-laws.
person.in-tithing — Person is enrolled in a frankpledge tithing.
person.independent-means — Person has own land or means and is not dependent on hiring out labour.
person.place — Non-empty place ID of the subject identified by act.object, independent of the population's jurisdiction ID. Authority queries use act.actor as the power holder, act.action as the domain/power, and act.place as empty until resolved; missing or invalid places fail explicitly.
person.sex — Life (stubbed): non-empty sex label of act.object; 'male' is preferred only when the law explicitly says prefer=male, other labels are not preferred, and null is unknown. Not read for prefer=none. An omitted law preference remains unresolved.
person.status — Person's legal or social status (tenant class, trade, office holder class).
person.stranger-without-suspicion — Lodger or stranger held overnight without ground for suspicion.
person.sworn-to-wage-rates — Worker has been sworn to keep statutory wage rates.
place.in — Whether an act or parcel lies in a named place set (region, distance band, franchise).
road.between-market-towns — Road runs between market towns for highway clearance rules.
tenant.died-holding — A manorial tenant died while holding of the manor.
tenant.unfree — Tenant holds in villein/unfree tenure.
trade.to-raise-price — Forestalling or regrating is done to raise price.
wages.at-pre-plague-rate — Wages are held to pre-plague rates under the 1349 ordinance.
wages.exceeds-statutory-rate — Wages paid or taken exceed the 1351 statutory rate.
wood.own — Woodland agisted is the actor's own property.
