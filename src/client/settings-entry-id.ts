/**
 * Which profile entry row the skin center's settings form is bound to.
 *
 * 0.1.7 addresses configuration as one form per profile entry id, and this
 * package can be installed under two different rows: the family aggregate's
 * generated `web-ui-skin-center` row, or its own standalone bundle row
 * `ui-skin-center` (cordis.patch.yml, and the `name` this plugin exports).
 * `ctx.configForms` carries no package identity, so the only authority on which
 * row is live is the served-namespace list in the shared describe mirror.
 *
 * dsh-skins#17 is the regression this module exists to prevent: the standalone
 * install used to fall back to the AGGREGATE row whenever the mirror had not
 * landed yet, so every `settings.mutate` addressed an entry the Host does not
 * serve. The Host refused the write, the custom-theme card reported a failed
 * save, and the skin switch rolled back and reported a failed apply — on a
 * profile whose skin directory and active API were both healthy.
 *
 * @module @linxin666/dsh-client-ui-skin-center/settings-entry-id
 */
import type { ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'

/** Profile entry id the family aggregate's generated row carries. */
const AGGREGATE_ENTRY_ID = 'web-ui-skin-center'

/**
 * This package's own declared plugin name, which is also the entry id its
 * standalone bundle patch row carries (cordis.patch.yml) and the `name` the
 * plugin exports (src/index.ts). It is the one safe guess when the describe
 * mirror cannot answer, because it names the row this package itself installs
 * rather than a row that belongs to a different package.
 */
const OWN_ENTRY_ID = 'ui-skin-center'

/**
 * Profile entry ids this package's rows can be served under: its own standalone
 * row, the family aggregate's generated row, and the legacy background
 * namespace a profile that named the row after it still serves. The served
 * mirror decides which one is real; this list only ranks the candidates.
 */
const SKIN_CENTER_ENTRY_IDS: readonly string[] = [OWN_ENTRY_ID, AGGREGATE_ENTRY_ID, 'skin-background']

/**
 * The entry id of the first skin-center row the Host says it serves, or `null`
 * when the mirror cannot say. `null` means "unknown", never "none": the mirror
 * is asynchronous, so an unreadable snapshot is a pre-boot window, not proof
 * that this package is absent.
 * @param forms - the shared configuration forms service.
 * @param candidates - entry ids to look for, in preference order.
 * @returns the served entry id, or `null` when the mirror cannot answer.
 */
export function servedEntryId(forms: ConfigForms, candidates: readonly string[] = SKIN_CENTER_ENTRY_IDS): string | null {
  let served: readonly string[] | undefined
  try {
    served = forms.describe().getSnapshot().view?.namespaces.map(view => view.ns)
  } catch {
    served = undefined
  }
  if (served === undefined) return null
  return candidates.find(id => served.includes(id)) ?? null
}

/**
 * The entry id to bind, which is this package's OWN row whenever the mirror
 * cannot name a skin-center row. Addressing another package's row is the #17
 * failure; addressing this one's own row is safe because an entry that is not
 * served reports itself `unavailable` instead of silently accepting a write.
 * @param forms - the shared configuration forms service.
 * @returns the entry id whose form the plugin should address.
 */
export function boundEntryId(forms: ConfigForms): string {
  return servedEntryId(forms) ?? OWN_ENTRY_ID
}
