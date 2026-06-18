// Lightweight i18n: a reactive current locale (shared via useState, persisted to
// a cookie and seeded from the cookie → Accept-Language → navigator) plus t()
// for plain messages and tc() for plural ones. SSR renders in the detected
// locale, so there is no English flash before hydration.
import { en, type Messages } from '~/i18n/locales/en'
import { fr } from '~/i18n/locales/fr'

export type Locale = 'en' | 'fr'

const SUPPORTED: Locale[] = ['en', 'fr']
const messages: Record<Locale, Messages> = { en, fr }

export const LOCALES: { code: Locale, label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

function isLocale(v: string | undefined): v is Locale {
  return v != null && (SUPPORTED as string[]).includes(v)
}

function resolve(root: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, k) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[k] : undefined),
    root,
  )
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`))
}

export function useI18n() {
  const cookie = useCookie<Locale>('locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })

  const locale = useState<Locale>('app-locale', () => {
    if (isLocale(cookie.value)) return cookie.value
    let header = ''
    if (import.meta.server) header = useRequestHeaders(['accept-language'])['accept-language'] ?? ''
    else if (import.meta.client) header = navigator.language ?? ''
    const base = header.toLowerCase().split(',')[0]?.trim().split('-')[0]
    return isLocale(base) ? base : 'en'
  })

  function setLocale(next: Locale): void {
    locale.value = next
    cookie.value = next
  }

  // Plain message: `t('a.b.c', { name })`. Falls back to English, then the key.
  function t(key: string, params?: Record<string, string | number>): string {
    const msg = resolve(messages[locale.value], key) ?? resolve(messages.en, key)
    return typeof msg === 'string' ? interpolate(msg, params) : key
  }

  // Plural message: picks the { one, other } branch via the locale's plural rules.
  function tc(key: string, count: number, params?: Record<string, string | number>): string {
    const node = resolve(messages[locale.value], key) ?? resolve(messages.en, key)
    if (node == null || typeof node !== 'object') return key
    const branch = node as Record<string, string | undefined>
    const category = new Intl.PluralRules(locale.value).select(count)
    const msg = branch[category] ?? branch.other
    return typeof msg === 'string' ? interpolate(msg, { n: count, ...params }) : key
  }

  // Locale-aware formatters — follow the chosen UI language, not the browser.
  const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
  function fmtCount(n: number | null): string {
    return n == null ? '—' : numberFormat.value.format(n)
  }
  function fmtDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' }) : '—'
  }

  return { locale, setLocale, locales: LOCALES, t, tc, fmtCount, fmtDate }
}
