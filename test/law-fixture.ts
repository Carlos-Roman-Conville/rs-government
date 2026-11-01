import type { Law } from '../src/law/schema.ts'

export function lawFixture(slug = 'fixture'): Law {
  return {
    id: `government/law.${slug}`, issuer: 'fixture', enactment: 'event.enactment', modality: 'prohibit',
    jurisdiction: { authority: 'office.council', places: 'all', persons: 'all', from: 0, until: null },
    regulated: { action: 'seize', object: 'any' }, condition: true, exceptions: [],
    consequence: { kind: 'void' }, enforcer: [], procedure: null, status: 'in-force', supersedes: [], sources: [],
  }
}
