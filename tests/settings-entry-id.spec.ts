/**
 * Which profile entry row the skin center binds its settings form to.
 *
 * 0.1.7 addresses configuration as one form per profile entry id, and this
 * package can be installed under two different rows: the family aggregate's
 * generated `web-ui-skin-center` row, or its own standalone bundle row
 * `ui-skin-center` (cordis.patch.yml, and the `name` the plugin exports). The
 * shared forms service carries no package identity, so the only authority on
 * which row is live is the served-namespace list in the describe mirror.
 *
 * dsh-skins#17 is the regression these tests guard: the standalone install
 * bound the AGGREGATE row whenever the mirror had not landed yet, so every
 * `settings.mutate` addressed an entry the Host does not serve. The Host refused
 * the write, the custom-theme card reported a failed save, and the skin switch
 * rolled back and reported a failed apply — on a profile whose skin directory
 * and active API were both healthy.
 *
 * The tests call the shipped resolver directly, so a reintroduced guess fails
 * here rather than on a user's Windows profile.
 */
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'
import { describe, expect, it } from 'vitest'

import { boundEntryId, servedEntryId } from '../src/client/settings-entry-id.ts'

/** Entry id the aggregate's generated row carries. */
const AGGREGATE_ENTRY_ID = 'web-ui-skin-center'

/** Entry id this package's own standalone bundle row carries. */
const OWN_ENTRY_ID = 'ui-skin-center'

/**
 * A `configForms` stub that records which entry id was asked for, and answers
 * `describe()` from the namespace list a Host would serve. `served: null`
 * models the pre-boot window in which the mirror cannot be read at all.
 */
function fakeForms(served: readonly string[] | null): { forms: ConfigForms; requested: string[] } {
  const requested: string[] = []
  const form = (): ConfigForm<unknown> => ({
    getSnapshot: () => ({ status: 'ready', value: {}, base: undefined, user: undefined, revision: 1, writable: true, mode: 'host' }),
    subscribe: () => () => {},
    set: async () => true,
    unset: async () => true,
    mutate: async () => true,
  })
  const forms = {
    describe: () => {
      if (served === null) throw new Error('the describe mirror is not ready')
      return { getSnapshot: () => ({ view: { namespaces: served.map(ns => ({ ns })) } }) }
    },
    get: (entryId: string) => {
      requested.push(entryId)
      return form()
    },
  } as unknown as ConfigForms
  return { forms, requested }
}

describe('the skin center binds the entry row the Host actually serves', () => {
  it('binds the standalone row when that is the row in the profile', () => {
    // Given a standalone install, where the profile carries only this
    // package's own row
    const { forms, requested } = fakeForms([OWN_ENTRY_ID])

    // When the entry id is resolved and the form is fetched
    const bound = boundEntryId(forms)
    forms.get(bound)

    // Then the standalone row is the one addressed, never the aggregate's
    expect(bound).toBe(OWN_ENTRY_ID)
    expect(requested).toEqual([OWN_ENTRY_ID])
  })

  it('binds the aggregate row when the family aggregate serves it', () => {
    // Given the family aggregate install, whose generated row is served
    const { forms } = fakeForms([AGGREGATE_ENTRY_ID])

    // When the entry id is resolved
    const bound = boundEntryId(forms)

    // Then the aggregate row is the one addressed
    expect(bound).toBe(AGGREGATE_ENTRY_ID)
  })

  it('does not bind the aggregate row when the mirror cannot answer', () => {
    // Given a describe mirror that is not readable yet — the exact window the
    // #17 report was filed in
    const { forms, requested } = fakeForms(null)

    // When the entry id is resolved before the mirror has landed
    const bound = boundEntryId(forms)
    forms.get(bound)

    // Then it binds this package's OWN row. Guessing the aggregate's row here
    // is what made every write address an entry the Host does not serve.
    expect(bound).toBe(OWN_ENTRY_ID)
    expect(requested).toEqual([OWN_ENTRY_ID])
  })

  it('reports an unknown entry id when the mirror cannot answer', () => {
    // Given an unreadable mirror
    const { forms } = fakeForms(null)

    // When the served row is asked for directly
    const served = servedEntryId(forms)

    // Then it is reported as unknown rather than guessed, so a caller can tell
    // "not served yet" from "served as this id"
    expect(served).toBeNull()
  })

  it('prefers the standalone row when a profile serves both', () => {
    // Given a profile that serves both rows, the package's own row is the one
    // this plugin's own patch file installed
    const { forms } = fakeForms([AGGREGATE_ENTRY_ID, OWN_ENTRY_ID])

    expect(boundEntryId(forms)).toBe(OWN_ENTRY_ID)
  })

  it('falls back to its own row when a profile serves neither', () => {
    // Given a deployment that serves no skin-center row at all: the form must
    // still be addressable by this package's own id and report unavailable,
    // rather than addressing a foreign entry
    const { forms, requested } = fakeForms(['some-other-plugin'])

    const bound = boundEntryId(forms)
    forms.get(bound)

    expect(bound).toBe(OWN_ENTRY_ID)
    expect(requested).toEqual([OWN_ENTRY_ID])
  })

  it('still resolves the legacy background namespace when only that is served', () => {
    // Given a profile that named the row after the legacy background namespace
    const { forms } = fakeForms(['skin-background'])

    // Then that row is still honoured
    expect(boundEntryId(forms)).toBe('skin-background')
  })
})
