import { describe, expect, it, vi } from 'vitest'
import { COMMUNICATION_KINDS, commRestrictions } from '../src/index.ts'
import type { Law } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

function communication(slug = 'print'): Law {
  return { ...lawFixture(slug), modality: 'prohibit', regulated: { action: 'print', object: 'any' } }
}
const facts = () => undefined

describe('communication suppression', () => {
  it('a print prohibition yields one Society command with the provisional payload', () => {
    const law = communication()
    law.regulated.object = { read: 'message.medium', op: 'eq', value: 'pamphlet' }
    law.jurisdiction.places = ['place.town']
    const read = vi.fn(facts)
    const before = structuredClone(law)
    const commands = commRestrictions([law], 10, read)
    expect(commands).toEqual([{ owner: 'society', type: 'comm_restriction', law: law.id,
      action: 'print', object: law.regulated.object, places: ['place.town'], from: 0, until: null }])
    expect(read).not.toHaveBeenCalled()
    expect(commands[0].object).not.toBe(law.regulated.object)
    expect(commands[0].places).not.toBe(law.jurisdiction.places)
    expect(law).toEqual(before)
  })

  it('a non-communication law yields no command', () => {
    expect(commRestrictions([lawFixture()], 10, facts)).toEqual([])
  })

  it('a superseded restriction emits only its later same-authority replacement', () => {
    const earlier = communication('earlier'), later = communication('later')
    later.jurisdiction.from = 10
    later.supersedes = [earlier.id]
    expect(commRestrictions([earlier, later], 9, facts).map(command => command.law)).toEqual([earlier.id])
    expect(commRestrictions([earlier, later], 10, facts).map(command => command.law)).toEqual([later.id])
  })

  it.each(['suspended', 'repealed'] as const)('a %s law yields no command', status => {
    expect(commRestrictions([{ ...communication(), status }], 10, facts)).toEqual([])
  })

  it.each([[9, 0], [10, 1], [19, 1], [20, 0]])('effective dates are inclusive from and exclusive until on day %s', (day, count) => {
    const law = communication()
    law.jurisdiction.from = 10
    law.jurisdiction.until = 20
    expect(commRestrictions([law], day, facts)).toHaveLength(count)
  })

  it('null bounds impose no time limit', () => {
    const law = communication()
    law.jurisdiction.from = null
    expect(commRestrictions([law], -100, facts)).toHaveLength(1)
  })

  it.each(COMMUNICATION_KINDS)('%s prohibitions and requirements emit, while permissions do not', action => {
    for (const modality of ['prohibit', 'require', 'permit', 'establish'] as const) {
      const law: Law = { ...communication(), modality, regulated: { action, object: 'any' } }
      expect(commRestrictions([law], 10, facts)).toHaveLength(modality === 'prohibit' || modality === 'require' ? 1 : 0)
    }
    const law: Law = { ...communication(), modality: 'empower', regulated: { action, object: 'any', power: action } }
    expect(commRestrictions([law], 10, facts)).toEqual([])
  })

  it('commands are sorted by law id without changing the input order', () => {
    const laws = [communication('z'), communication('a')]
    expect(commRestrictions(laws, 10, facts).map(command => command.law)).toEqual([laws[1].id, laws[0].id])
    expect(laws[0].id).toBe('government/law.z')
  })
})
