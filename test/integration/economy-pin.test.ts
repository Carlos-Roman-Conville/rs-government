import { lstatSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as economy from '@rex/economy'

// Import smoke test for the pinned Economy release (v0.1.0).
// Economy v0.1.0 exports no harvest function, so the demo's `economy.harvest` stub has no counterpart yet.
describe('Economy pin', () => {
  it('resolves from node_modules as a real directory, not a link', () => {
    expect(lstatSync('node_modules/@rex/economy').isSymbolicLink()).toBe(false)
  })

  it('exports isCurrency', () => {
    expect(typeof economy.isCurrency).toBe('function')
  })
})
