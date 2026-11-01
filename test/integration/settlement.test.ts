import { describe, expect, it, vi } from 'vitest'
import { Runner, defaultConfig, initialState, officePowersAuthority, stubProviders } from '@rex/settlement'
import type { Command } from '@rex/settlement'
import { createAuthorityProvider, defaultAuthorityProvider, validateLaw } from '../../src/index.ts'
import type { ActFacts, Law } from '../../src/index.ts'

const powers = ['permit', 'seize', 'public-title'] as const
type Power = typeof powers[number]
const operations = [
  { type: 'grantPermission', power: 'permit' },
  { type: 'revokePermission', power: 'permit' },
  { type: 'transfer', power: 'seize' },
  { type: 'grantTitle', power: 'public-title' },
] as const
type Operation = typeof operations[number]

// Minimal copy of Settlement's fresh()/U22/U23 setup, using its public API only.
function fresh() {
  const providers = stubProviders()
  const r = new Runner(initialState('stl.test', 'test'), defaultConfig(), providers)
  const district = r.run<string>({ type: 'addDistrict', name: 'housing', kind: 'housing',
    bounds: { x: 0, y: 0, w: 50, h: 50 } })
  const parcel = r.run<string>({ type: 'addParcel', district,
    footprint: { x: 0, y: 0, w: 10, h: 10 }, access: ['road'] })
  const outside = r.run<string>({ type: 'addParcel', district,
    footprint: { x: 20, y: 0, w: 10, h: 10 }, access: ['road'] })
  const titles = Object.fromEntries([parcel, outside].map(subject => [subject,
    r.run<string>({ type: 'grantTitle', subject, holder: 'owner' })]))
  const a = r.run<string>({ type: 'createOffice', name: 'A', powers: [] })
  const b = r.run<string>({ type: 'createOffice', name: 'B', powers: [] })
  r.run({ type: 'appoint', office: a, holder: 'incumbent' })
  r.run({ type: 'appoint', office: b, holder: 'clerk' })
  // The port's historical read name is person.place; the host resolves land IDs
  // too. Office seats deliberately differ, so a null/wrong subject cannot pass.
  const facts: ActFacts = (name, act) => {
    if (name === 'person.place') return act.object === null ? undefined : r.state.parcels[act.object]?.id
    if (name === 'office.seat') return 'elsewhere'
    throw new Error(`Unexpected fact read: ${name}`)
  }
  const authority = (laws: readonly Law[]) => createAuthorityProvider(laws, facts,
    office => r.state.offices[office]?.id ?? null)
  return { r, providers, parcel, outside, titles, a, b, authority }
}
type Fixture = ReturnType<typeof fresh>

function empower(office: string, power: Power, places: Law['jurisdiction']['places']): Law {
  const law: Law = {
    id: `government/law.fixture-${power}`, issuer: 'fixture', enactment: 'Integration fixture',
    jurisdiction: { authority: 'fixture-council', places, persons: 'all', from: 0, until: null },
    modality: 'empower', regulated: { action: `exercise:${power}`, object: 'any', power },
    condition: { read: 'actor.office', op: 'eq', value: office }, exceptions: [],
    consequence: { kind: 'void' }, enforcer: [], procedure: null,
    status: 'in-force', supersedes: [], sources: [],
  }
  expect(validateLaw(law)).toEqual([])
  return law
}

// Prepare existing records before installing the provider under test.
function prepare(ctx: Fixture, operation: Operation) {
  const { r, providers, parcel, outside, titles, a, authority } = ctx
  const permissions: Record<string, string> = {}
  if (operation.type === 'revokePermission') {
    providers.authority = authority([empower(a, 'permit', 'all')])
    for (const subject of [parcel, outside]) {
      permissions[subject] = r.run<string>({ type: 'grantPermission', office: a, kind: 'build', subject })
    }
    delete providers.authority
  }
  if (operation.type === 'grantTitle') {
    for (const subject of [parcel, outside]) r.run({ type: 'transfer', title: titles[subject], to: 'none', kind: 'transfer' })
  }
  return (office: string, subject: string): Command => {
    switch (operation.type) {
      case 'grantPermission': return { type: 'grantPermission', office, subject, kind: 'build' }
      case 'revokePermission': return { type: 'revokePermission', office, permission: permissions[subject] }
      case 'transfer': return { type: 'transfer', title: titles[subject], to: 'town', kind: 'seizure', authority: office }
      case 'grantTitle': return { type: 'grantTitle', subject, holder: 'town', authority: office }
    }
  }
}

function refused(r: Runner, command: Command, message: string) {
  const before = structuredClone({ state: r.state, events: r.events, log: r.log })
  expect(() => r.run(command)).toThrowError(new Error(message))
  expect({ state: r.state, events: r.events, log: r.log }).toEqual(before)
}

function succeeded(ctx: Fixture, operation: Operation, command: Command) {
  const result = ctx.r.run<string>(command)
  if (command.type === 'grantPermission') {
    expect(ctx.r.state.permissions[result]).toMatchObject({ subject: command.subject, grantedBy: command.office, status: 'active' })
  } else if (command.type === 'revokePermission') {
    expect(ctx.r.state.permissions[command.permission].status).toBe('revoked')
  } else {
    expect(ctx.r.state.titles[ctx.titles[ctx.parcel]].holder).toBe('town')
    expect(ctx.r.state.ledger.at(-1)).toMatchObject({
      kind: operation.power === 'seize' ? 'seizure' : 'grant', authority: ctx.a,
    })
  }
}

describe('DUP-62 Government and Settlement combined acceptance (§7)', () => {
  it.each(operations)('§7.1 $type uses empower laws and the land subject for jurisdiction', operation => {
    const ctx = fresh()
    const command = prepare(ctx, operation)
    const { r, providers, a, b, parcel, outside, authority } = ctx
    const provider = authority([empower(a, operation.power, [parcel])])
    const may = vi.fn(provider.may)
    providers.authority = { may }
    expect(Object.values(r.state.offices).map(office => office.powers)).toEqual([[], []])

    refused(r, command(b, parcel), `office ${b} lacks the power '${operation.power}'`)
    refused(r, command(a, outside), `office ${a} lacks the power '${operation.power}'`)
    succeeded(ctx, operation, command(a, parcel))
    expect(may.mock.calls).toEqual([
      [b, operation.power, parcel, r.state.settlement.day],
      [a, operation.power, outside, r.state.settlement.day],
      [a, operation.power, parcel, r.state.settlement.day],
    ])
  })

  it('§7.2 succession changes the holder only through appoint, then vacate refuses the office', () => {
    const { r, providers, a, parcel, authority } = fresh()
    const laws = [empower(a, 'permit', [parcel])]
    const beforeLaws = structuredClone(laws)
    providers.authority = authority(laws)
    // Fixture Government decision at the command boundary; choosing a successor
    // and checking who may act in the office's name are outside this port contract.
    const decision: Command = { type: 'appoint', office: a, holder: 'successor' }
    expect(r.state.offices[a].holder).toBe('incumbent')
    const eventCount = r.events.length
    r.run(decision)
    expect(r.log.at(-1)).toEqual(decision)
    expect(r.state.offices[a].holder).toBe('successor')
    expect(r.events.slice(eventCount)).toEqual([{ type: 'officeChanged', office: a, holder: 'successor' }])
    r.run({ type: 'grantPermission', office: a, kind: 'build', subject: parcel })
    r.run({ type: 'vacate', office: a })
    expect(r.state.offices[a].holder).toBeNull()
    expect(r.events.at(-1)).toEqual({ type: 'officeChanged', office: a, holder: null })
    expect(providers.authority.may(a, 'permit', parcel, r.state.settlement.day)).toBe(true)
    refused(r, { type: 'grantPermission', office: a, kind: 'build', subject: parcel }, `office is vacant: ${a}`)
    // Government owns only the unchanged laws; no holder record is mirrored there.
    expect(laws).toEqual(beforeLaws)
    expect(JSON.stringify(laws)).not.toContain('"holder"')
    expect(JSON.stringify(laws)).not.toContain('successor')
  })

  it.each(operations)('§7.3 editing Office.powers cannot change law-backed $type answers', operation => {
    const ctx = fresh()
    const command = prepare(ctx, operation)
    const { r, providers, a, b, parcel, outside, authority } = ctx
    providers.authority = authority([empower(a, operation.power, [parcel])])
    const answers = () => [a, b].flatMap(office => [parcel, outside].map(subject =>
      providers.authority!.may(office, operation.power, subject, r.state.settlement.day)))
    expect(answers()).toEqual([true, false, false, false])
    r.state.offices[a].powers = ['unrelated']
    r.state.offices[b].powers = [...powers]
    expect(answers()).toEqual([true, false, false, false])
    refused(r, command(b, parcel), `office ${b} lacks the power '${operation.power}'`)
    refused(r, command(a, outside), `office ${a} lacks the power '${operation.power}'`)
    succeeded(ctx, operation, command(a, parcel))
  })

  it.each(operations)('§2 vacant offices refuse $type before asking the law provider', operation => {
    const ctx = fresh()
    const command = prepare(ctx, operation)
    const { r, providers, a, parcel, authority } = ctx
    r.run({ type: 'vacate', office: a })
    const provider = authority([empower(a, operation.power, [parcel])])
    expect(provider.may(a, operation.power, parcel, r.state.settlement.day)).toBe(true)
    const may = vi.fn(provider.may)
    providers.authority = { may }
    refused(r, command(a, parcel), `office is vacant: ${a}`)
    expect(may).toHaveBeenCalledTimes(0)
  })

  it.each(operations)('§7.4 implicit and explicit defaults give identical $type outputs over 30 days', operation => {
    function run(explicit: boolean) {
      const ctx = fresh()
      const command = prepare(ctx, operation)
      const { r, providers, a, b, parcel } = ctx
      r.state.offices[a].powers = [...powers]
      expect(providers.authority).toBeUndefined()
      // Runner replaces state on each command; rebind the exported default to
      // the current snapshot rather than accidentally retaining stale offices.
      const bind = () => {
        if (explicit) providers.authority = officePowersAuthority(r.state)
      }
      bind()
      refused(r, command(b, parcel), `office ${b} lacks the power '${operation.power}'`)
      succeeded(ctx, operation, command(a, parcel))
      if (operation.type === 'transfer' || operation.type === 'grantTitle') {
        r.run({ type: 'transfer', title: ctx.titles[parcel], kind: 'transfer',
          to: operation.type === 'grantTitle' ? 'none' : 'owner' })
      }
      r.run({ type: 'vacate', office: a })
      bind()
      refused(r, command(a, parcel), `office is vacant: ${a}`)
      for (let day = 0; day < 30; day++) { bind(); r.tick() }
      return JSON.stringify({ state: r.state, events: r.events, log: r.log })
    }
    expect(run(true)).toBe(run(false))
  })

  it('§7.4 Government and Settlement defaults agree for every office/power pair, even when vacant', () => {
    const { r, a, b, parcel, outside } = fresh()
    const vacant = r.run<string>({ type: 'createOffice', name: 'vacant', powers: ['permit'] })
    for (const assigned of [[], ['permit'], ['seize', 'public-title'], [...powers]]) {
      r.state.offices[a].powers = assigned
      const government = defaultAuthorityProvider(Object.values(r.state.offices))
      const settlement = officePowersAuthority(r.state)
      for (const office of [a, b, vacant, 'missing']) {
        for (const power of [...powers, 'unknown']) {
          for (const subject of [parcel, outside, null]) {
            for (const day of [0, 30]) {
              const expected = r.state.offices[office]?.powers.includes(power) ?? false
              expect(settlement.may(office, power, subject, day)).toBe(expected)
              expect(government.may(office, power, subject, day)).toBe(settlement.may(office, power, subject, day))
            }
          }
        }
      }
    }
  })

  it('same-authority supersession stops the grant exactly when the replacement takes force', () => {
    const { r, providers, a, parcel, authority } = fresh()
    const grant = empower(a, 'permit', [parcel])
    const replacement: Law = {
      ...grant, id: 'government/law.replacement', modality: 'prohibit',
      regulated: { action: 'exercise:permit', object: 'any' },
      jurisdiction: { ...grant.jurisdiction, from: 2 }, supersedes: [grant.id],
    }
    expect(validateLaw(replacement)).toEqual([])
    providers.authority = authority([grant, replacement])
    r.tick()
    expect(r.state.settlement.day).toBe(1)
    const permission = r.run<string>({ type: 'grantPermission', office: a, kind: 'build', subject: parcel })
    expect(r.state.permissions[permission].status).toBe('active')
    r.tick()
    expect(r.state.settlement.day).toBe(2)
    refused(r, { type: 'grantPermission', office: a, kind: 'build', subject: parcel },
      `office ${a} lacks the power 'permit'`)
    expect(grant.status).toBe('in-force') // Withdrawal is computed from supersession.
    expect(r.state.permissions[permission].status).toBe('active')
  })
})
