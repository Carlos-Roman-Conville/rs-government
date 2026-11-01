import { describe, expect, it } from 'vitest'
import { governmentId } from '../src/index.ts'

describe('ids', () => {
  it('qualifies a local id with the government prefix', () => {
    expect(governmentId('law.assize-of-bread')).toBe('government/law.assize-of-bread')
  })
  it('refuses a local id containing /', () => {
    expect(() => governmentId('law.a/b')).toThrow()
  })
})
