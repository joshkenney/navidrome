// Dates are passed around as local days, "YYYY-MM-DD"

const pad = (n) => String(n).padStart(2, '0')

export const toDay = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseDay = (day) => {
  const [y, m, d] = (day || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export const addDays = (date, n) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)

// How many minutes the browser's clock is ahead of UTC, as the server expects it
export const tzOffset = (date = new Date()) => -date.getTimezoneOffset()

export const daysBetween = (from, to) =>
  Math.round((parseDay(to) - parseDay(from)) / 86400000)

const startOfWeek = (date) => addDays(date, -((date.getDay() + 6) % 7)) // Monday
const lastDayOfMonth = (y, m) => new Date(y, m + 1, 0)

const range = (from, to, label, extra = {}) => ({
  from: toDay(from),
  to: toDay(to),
  label,
  ...extra,
})

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const monthIndex = (word) => {
  if (!word || word.length < 3) return -1
  return MONTHS.findIndex((m) => m.startsWith(word))
}

// Months of each season, in the northern hemisphere. Winter starts in December of the year before
const SEASONS = {
  spring: [2, 4],
  summer: [5, 7],
  fall: [8, 10],
  autumn: [8, 10],
  winter: [11, 13],
}

const monthName = (m) =>
  new Date(2000, m, 1).toLocaleString(undefined, { month: 'long' })

const monthRange = (y, m) =>
  range(new Date(y, m, 1), lastDayOfMonth(y, m), `${monthName(m)} ${y}`)

const seasonRange = (season, y) => {
  const [first, last] = SEASONS[season]
  const from = new Date(first === 11 ? y - 1 : y, first === 11 ? 11 : first, 1)
  const to = lastDayOfMonth(y, last === 13 ? 1 : last)
  const name = season[0].toUpperCase() + season.slice(1)
  return range(from, to, `${name} ${y}`)
}

const isYear = (n) => n >= 1900 && n <= 2100

// Understands a date typed in search or in the timeline: "today", "last week", "june", "last june",
// "june 2025", "june 5", "2025-06-05", "6/5/2025", "summer 2024", "last summer", "past 30 days",
// "2025", "1990s" or "90s". Returns the days it covers ({from, to, label}), or null.
// Years and decades also come with yearFrom and yearTo, to find music released then
export const parseDateQuery = (text, now = new Date()) => {
  const q = (text || '')
    .toLowerCase()
    .trim()
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
  if (!q) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const y = today.getFullYear()
  const m = today.getMonth()
  let match

  switch (q) {
    case 'today':
      return range(today, today, 'Today')
    case 'yesterday':
      return range(addDays(today, -1), addDays(today, -1), 'Yesterday')
    case 'this week':
      return range(startOfWeek(today), today, 'This week')
    case 'last week': {
      const start = addDays(startOfWeek(today), -7)
      return range(start, addDays(start, 6), 'Last week')
    }
    case 'this month':
      return range(new Date(y, m, 1), today, 'This month')
    case 'last month':
      return monthRange(m === 0 ? y - 1 : y, (m + 11) % 12)
    case 'this year':
      return range(new Date(y, 0, 1), today, 'This year')
    case 'last year':
      return range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31), `${y - 1}`)
    default:
  }

  // past 30 days, last 2 weeks, past 3 months
  if ((match = q.match(/^(?:past|last) (\d{1,3}) (day|week|month)s?$/))) {
    const n = Number(match[1])
    const from =
      match[2] === 'month'
        ? new Date(y, m - n, today.getDate() + 1)
        : addDays(today, -(match[2] === 'week' ? n * 7 : n) + 1)
    return range(from, today, `Past ${n} ${match[2]}${n === 1 ? '' : 's'}`)
  }

  // 2025-06-05, 2025-06
  if ((match = q.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) {
    const [yy, mm, dd] = [Number(match[1]), Number(match[2]) - 1, match[3]]
    if (!isYear(yy) || mm < 0 || mm > 11) return null
    if (!dd) return monthRange(yy, mm)
    const day = new Date(yy, mm, Number(dd))
    if (day.getMonth() !== mm) return null
    return range(day, day, day.toLocaleDateString())
  }

  // 6/5/2025 (month first)
  if ((match = q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const [mm, dd, yy] = [
      Number(match[1]) - 1,
      Number(match[2]),
      Number(match[3]),
    ]
    const day = new Date(yy, mm, dd)
    if (!isYear(yy) || day.getMonth() !== mm) return null
    return range(day, day, day.toLocaleDateString())
  }

  // 2025: a year
  if ((match = q.match(/^(\d{4})$/)) && isYear(Number(match[1]))) {
    const yy = Number(match[1])
    return range(new Date(yy, 0, 1), new Date(yy, 11, 31), `${yy}`, {
      yearFrom: yy,
      yearTo: yy,
    })
  }

  // 1990s, 90s, '90s
  if ((match = q.match(/^'?(\d{2}|\d{4})s$/))) {
    let start = Number(match[1])
    if (match[1].length === 2) start += start >= 30 ? 1900 : 2000
    if (!isYear(start) || start % 10 !== 0) return null
    return range(
      new Date(start, 0, 1),
      new Date(start + 9, 11, 31),
      `${start}s`,
      {
        yearFrom: start,
        yearTo: start + 9,
      },
    )
  }

  // summer 2024, last summer, winter
  if (
    (match = q.match(
      /^(last |this )?(spring|summer|fall|autumn|winter)(?: (\d{4}))?$/,
    ))
  ) {
    const [, which, season, year] = match
    if (year)
      return isYear(Number(year)) ? seasonRange(season, Number(year)) : null
    // The latest season that has started, or the one before it for "last"
    // (winters are named after the year they end in)
    const [first] = SEASONS[season]
    let yy = first === 11 ? (m === 11 ? y + 1 : y) : m >= first ? y : y - 1
    if (which === 'last ') yy -= 1
    return seasonRange(season, yy)
  }

  // june, last june, june 2025, june 5, june 5 2025, 5 june 2025
  if (
    (match = q.match(/^(last |this )?([a-z]+)(?: (\d{1,2}))?(?: (\d{4}))?$/)) ||
    (match = q.match(/^()(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/))
  ) {
    let [, which, word, dayOfMonth, year] = match
    if (/^\d/.test(word)) [word, dayOfMonth] = [dayOfMonth, word]
    const mm = monthIndex(word)
    if (mm < 0) return null
    let yy = year ? Number(year) : mm > m ? y - 1 : y
    if (which === 'last ' && !year && mm === m) yy -= 1
    if (!isYear(yy)) return null
    if (!dayOfMonth) return monthRange(yy, mm)
    const day = new Date(yy, mm, Number(dayOfMonth))
    if (day.getMonth() !== mm) return null
    return range(day, day, day.toLocaleDateString())
  }
  return null
}

// The ranges offered as quick choices on the timeline
export const presetRange = (preset, now = new Date(), first = null) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'week':
      return parseDateQuery('this week', now)
    case 'month':
      return parseDateQuery('this month', now)
    case 'last30':
      return parseDateQuery('past 30 days', now)
    case 'year':
      return parseDateQuery('this year', now)
    case 'all':
      return range(
        first ? parseDay(first) : addDays(today, -365),
        today,
        'All time',
      )
    default:
      return parseDateQuery('today', now)
  }
}

// Shows a range of days in words: "June 1 – June 30, 2026", or a single day
export const formatRange = (from, to) => {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b) return ''
  const opts = { month: 'short', day: 'numeric', year: 'numeric' }
  if (from === to)
    return a.toLocaleDateString(undefined, { ...opts, weekday: 'short' })
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`
}

export const formatDuration = (seconds) => {
  const minutes = Math.round((seconds || 0) / 60)
  const h = Math.floor(minutes / 60)
  const min = minutes % 60
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return h ? `${h}h ${min}m` : `${min}m`
}

// Every day between two days with its listening (none when missing), grouped into weeks or months
// when there would be too many bars
export const fillDays = (days, from, to, maxBars = 120) => {
  const byDate = new Map((days || []).map((d) => [d.date, d]))
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || end < start) return { unit: 'day', bars: [] }
  const total = daysBetween(from, to) + 1
  const unit =
    total <= maxBars ? 'day' : total <= maxBars * 7 ? 'week' : 'month'
  const bars = []
  let current = null
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key =
      unit === 'day'
        ? toDay(d)
        : unit === 'week'
          ? toDay(startOfWeek(d))
          : toDay(new Date(d.getFullYear(), d.getMonth(), 1))
    if (!current || current.key !== key) {
      current = { key, from: toDay(d), to: toDay(d), plays: 0, seconds: 0 }
      bars.push(current)
    }
    current.to = toDay(d)
    const day = byDate.get(toDay(d))
    if (day) {
      current.plays += day.plays
      current.seconds += day.seconds
    }
  }
  return { unit, bars }
}
