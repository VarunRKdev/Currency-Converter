import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { HiArrowsRightLeft } from 'react-icons/hi2'
import { format, parseISO } from 'date-fns'

type Theme = 'light' | 'dark'

type ConversionHistoryItem = {
  id: string
  timestamp: string
  amount: number
  from: string
  to: string
  rate: number
  result: number
}

type CurrencyOption = {
  code: string
  name: string
}

type LastUpdated = {
  fetchedAt: string
  effectiveDate: string
}

const API_BASE = 'https://api.frankfurter.app'
const HISTORY_KEY = 'cc-history'
const PREFS_KEY = 'cc-preferences'
const THEME_KEY = 'cc-theme'

// Common currencies available immediately for better UX
const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
]

const preferDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches

const loadLocalStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) {
      return fallback
    }
    return JSON.parse(stored) as T
  } catch (error) {
    console.warn(`Failed to parse localStorage item "${key}"`, error)
    return fallback
  }
}

const App = () => {
  const [amountInput, setAmountInput] = useState<string>('1')
  const [fromCurrency, setFromCurrency] = useState<string>(() => {
    const prefs = loadLocalStorage<{ from: string; to: string } | null>(
      PREFS_KEY,
      null,
    )
    return prefs?.from ?? 'USD'
  })
  const [toCurrency, setToCurrency] = useState<string>(() => {
    const prefs = loadLocalStorage<{ from: string; to: string } | null>(
      PREFS_KEY,
      null,
    )
    return prefs?.to ?? 'EUR'
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = loadLocalStorage<Theme | null>(THEME_KEY, null)
    if (stored) {
      return stored
    }
    return preferDark() ? 'dark' : 'light'
  })
  const [currencies, setCurrencies] = useState<CurrencyOption[]>(COMMON_CURRENCIES)
  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(true)
  const [conversionRate, setConversionRate] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<LastUpdated | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<ConversionHistoryItem[]>(() =>
    loadLocalStorage<ConversionHistoryItem[]>(HISTORY_KEY, []),
  )

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amountInput.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }, [amountInput])

  const convertedAmount = useMemo(() => {
    if (conversionRate === null) {
      return null
    }
    const total = numericAmount * conversionRate
    if (!Number.isFinite(total)) {
      return null
    }
    return total
  }, [numericAmount, conversionRate])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const controller = new AbortController()
    const fetchCurrencies = async () => {
      try {
        setIsCurrenciesLoading(true)
        const response = await axios.get<Record<string, string>>(
          `${API_BASE}/currencies`,
          { signal: controller.signal },
        )
        const options = Object.entries(response.data)
          .map(([code, name]) => ({ code, name }))
          .sort((a, b) => a.code.localeCompare(b.code))
        setCurrencies(options)

        // Validate selected currencies are in the API's list
        const currencyCodes = new Set(options.map((c) => c.code))
        setFromCurrency((prev) => (currencyCodes.has(prev) ? prev : 'USD'))
        setToCurrency((prev) => (currencyCodes.has(prev) ? prev : 'EUR'))
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error(error)
          // Keep common currencies even if API fails
          setErrorMessage(
            'Unable to load all currencies. Using common currencies only.',
          )
        }
      } finally {
        setIsCurrenciesLoading(false)
      }
    }

    void fetchCurrencies()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ from: fromCurrency, to: toCurrency }),
    )
  }, [fromCurrency, toCurrency])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const handleConvert = useCallback(
    async (source: 'user' | 'auto' = 'user') => {
      if (numericAmount <= 0) {
        if (source === 'user') {
          setErrorMessage('Enter an amount greater than zero to convert.')
        }
        setConversionRate(null)
        return
      }

      setIsConverting(true)
      if (source === 'user') {
        setErrorMessage(null)
      }

      try {
        if (fromCurrency === toCurrency) {
          const timestamp = new Date().toISOString()
          setConversionRate(1)
          setLastUpdated({
            fetchedAt: timestamp,
            effectiveDate: format(new Date(), 'yyyy-MM-dd'),
          })

          if (source === 'user') {
            const record: ConversionHistoryItem = {
              id: crypto.randomUUID(),
              timestamp,
              amount: numericAmount,
              from: fromCurrency,
              to: toCurrency,
              rate: 1,
              result: numericAmount,
            }
            setHistory((prev) => [record, ...prev].slice(0, 5))
          }
          return
        }

        const response = await axios.get<{
          amount: number
          base: string
          date: string
          rates: Record<string, number>
        }>(`${API_BASE}/latest`, {
          params: {
            from: fromCurrency,
            to: toCurrency,
          },
        })

        const rate = response.data.rates[toCurrency]
        if (!rate) {
          throw new Error('Rate unavailable')
        }

        const timestamp = new Date().toISOString()

        setConversionRate(rate)
        setLastUpdated({
          fetchedAt: timestamp,
          effectiveDate: response.data.date,
        })

        if (source === 'user') {
          const record: ConversionHistoryItem = {
            id: crypto.randomUUID(),
            timestamp,
            amount: numericAmount,
            from: fromCurrency,
            to: toCurrency,
            rate,
            result: numericAmount * rate,
          }
          setHistory((prev) => [record, ...prev].slice(0, 5))
        }
      } catch (error) {
        console.error(error)
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setErrorMessage(
            `Exchange rate not available for ${fromCurrency} to ${toCurrency}. The API may not support one or both of these currencies.`,
          )
        } else {
          setErrorMessage(
            'We ran into an issue fetching the conversion. Please try again.',
          )
        }
      } finally {
        setIsConverting(false)
      }
    },
    [fromCurrency, toCurrency, numericAmount],
  )

  useEffect(() => {
    // Don't wait for full currency list - convert as soon as we have currencies
    // (which includes common currencies from the start)
    if (currencies.length === 0) {
      return
    }
    void handleConvert('auto')
  }, [fromCurrency, toCurrency, handleConvert, currencies.length])

  const formattedFetchedAt = useMemo(() => {
    if (!lastUpdated) {
      return null
    }
    return format(parseISO(lastUpdated.fetchedAt), 'PPpp')
  }, [lastUpdated])

  const formattedEffectiveDate = useMemo(() => {
    if (!lastUpdated) {
      return null
    }
    return format(parseISO(lastUpdated.effectiveDate), 'PP')
  }, [lastUpdated])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const currenciesContent = useMemo(() => {
    if (isCurrenciesLoading && currencies.length === COMMON_CURRENCIES.length) {
      return (
        <>
          {currencies.map(({ code, name }) => (
            <option key={code} value={code}>
              {code} — {name}
            </option>
          ))}
          <option value="" disabled>
            Loading more currencies...
          </option>
        </>
      )
    }
    return currencies.map(({ code, name }) => (
      <option key={code} value={code}>
        {code} — {name}
      </option>
    ))
  }, [currencies, isCurrenciesLoading])

  return (
    <div className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 text-slate-900 transition-colors duration-300 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Currency Converter
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isCurrenciesLoading
                ? 'Loading available currencies...'
                : `Convert money across ${currencies.length} currencies with live exchange rates, recent history, and trends.`}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-amber-400" />
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-lg shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-slate-900/50">
            <form
              className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
              onSubmit={(event) => {
                event.preventDefault()
                void handleConvert()
              }}
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  placeholder="Enter amount"
                />
              </label>

              <div className="flex justify-center py-6 md:py-0">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="group inline-flex h-12 w-12 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:-translate-y-0.5 hover:bg-indigo-100 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-indigo-800/50 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                  title="Swap currencies"
                >
                  <HiArrowsRightLeft className="text-xl transition-transform group-hover:rotate-180" />
                </button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    From
                  </span>
                  <select
                    value={fromCurrency}
                    onChange={(event) => setFromCurrency(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  >
                    {currenciesContent}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    To
                  </span>
                  <select
                    value={toCurrency}
                    onChange={(event) => setToCurrency(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  >
                    {currenciesContent}
                  </select>
                </label>
              </div>

              <div className="md:col-span-3">
                <div className="flex flex-col gap-4 rounded-2xl bg-slate-900/5 p-5 dark:bg-slate-100/5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Conversion Rate
                      </p>
                      {conversionRate !== null ? (
                        <p className="text-2xl font-bold">
                          1 {fromCurrency} ={' '}
                          <span className="text-indigo-600 dark:text-indigo-300">
                            {conversionRate.toLocaleString(undefined, {
                              maximumFractionDigits: 6,
                            })}
                          </span>{' '}
                          {toCurrency}
                        </p>
                      ) : (
                        <p className="text-2xl font-semibold text-slate-400">
                          No rate yet
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isConverting}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isConverting ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Converting...
                        </span>
                      ) : (
                        'Convert'
                      )}
                    </button>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {convertedAmount !== null && amountInput !== ''
                        ? `${numericAmount.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })} ${fromCurrency} = `
                        : 'Enter an amount to see the conversion'}
                      {convertedAmount !== null && amountInput !== '' && (
                        <span className="text-xl font-semibold text-indigo-600 dark:text-indigo-300">
                          {convertedAmount.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{' '}
                          {toCurrency}
                        </span>
                      )}
                    </p>
                    {lastUpdated && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                        Effective {formattedEffectiveDate} • Fetched{' '}
                        {formattedFetchedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200">
                {errorMessage}
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Recent Conversions
              </h2>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Your last five conversions will appear here.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {item.amount.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{' '}
                          {item.from}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                          {item.result.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{' '}
                          {item.to}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Rate:{' '}
                          {item.rate.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}
                        </span>
                        <span>
                          {format(parseISO(item.timestamp), 'PPpp')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}

export default App


