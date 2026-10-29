import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  fillDays,
  formatDuration,
  parseDateQuery,
  presetRange,
  toDay,
} from './dates'

// Wednesday, October 28, 2026
const now = new Date(2026, 9, 28, 15, 0)
const days = (q) => {
  const r = parseDateQuery(q, now)
  return r && [r.from, r.to]
}

describe('parseDateQuery', () => {
  it('understands relative days', () => {
    expect(days('today')).toEqual(['2026-10-28', '2026-10-28'])
    expect(days('Yesterday')).toEqual(['2026-10-27', '2026-10-27'])
    expect(days('this week')).toEqual(['2026-10-26', '2026-10-28'])
    expect(days('last week')).toEqual(['2026-10-19', '2026-10-25'])
    expect(days('last month')).toEqual(['2026-09-01', '2026-09-30'])
    expect(days('last year')).toEqual(['2025-01-01', '2025-12-31'])
    expect(days('past 30 days')).toEqual(['2026-09-29', '2026-10-28'])
    expect(days('last 2 weeks')).toEqual(['2026-10-15', '2026-10-28'])
  })

  it('understands months, finding the latest one', () => {
    expect(days('june')).toEqual(['2026-06-01', '2026-06-30'])
    expect(days('december')).toEqual(['2025-12-01', '2025-12-31'])
    expect(days('last october')).toEqual(['2025-10-01', '2025-10-31'])
    expect(days('feb 2024')).toEqual(['2024-02-01', '2024-02-29'])
    expect(days('June 5')).toEqual(['2026-06-05', '2026-06-05'])
    expect(days('5 june 2025')).toEqual(['2025-06-05', '2025-06-05'])
    expect(days('june 5, 2025')).toEqual(['2025-06-05', '2025-06-05'])
  })

  it('understands written dates', () => {
    expect(days('2025-03-14')).toEqual(['2025-03-14', '2025-03-14'])
    expect(days('2025-03')).toEqual(['2025-03-01', '2025-03-31'])
    expect(days('3/14/2025')).toEqual(['2025-03-14', '2025-03-14'])
    expect(days('2025-02-30')).toBeNull()
  })

  it('understands seasons', () => {
    expect(days('summer 2024')).toEqual(['2024-06-01', '2024-08-31'])
    expect(days('summer')).toEqual(['2026-06-01', '2026-08-31'])
    expect(days('last summer')).toEqual(['2025-06-01', '2025-08-31'])
    expect(days('winter')).toEqual(['2025-12-01', '2026-02-28'])
    expect(days('winter 2024')).toEqual(['2023-12-01', '2024-02-29'])
  })

  it('gives release years for years and decades', () => {
    expect(parseDateQuery('1997', now)).toMatchObject({
      from: '1997-01-01',
      to: '1997-12-31',
      yearFrom: 1997,
      yearTo: 1997,
    })
    expect(parseDateQuery('90s', now)).toMatchObject({
      yearFrom: 1990,
      yearTo: 1999,
    })
    expect(parseDateQuery('2000s', now)).toMatchObject({
      yearFrom: 2000,
      yearTo: 2009,
    })
    expect(parseDateQuery('today', now).yearFrom).toBeUndefined()
  })

  it('ignores what is not a date', () => {
    expect(parseDateQuery('radiohead', now)).toBeNull()
    expect(parseDateQuery('ju', now)).toBeNull()
    expect(parseDateQuery('12345', now)).toBeNull()
    expect(parseDateQuery('', now)).toBeNull()
  })
})

describe('presetRange', () => {
  it('starts "all time" at the first play', () => {
    expect(presetRange('all', now, '2025-12-06')).toMatchObject({
      from: '2025-12-06',
      to: '2026-10-28',
    })
  })
})

describe('fillDays', () => {
  it('fills the days without listening', () => {
    const { unit, bars } = fillDays(
      [{ date: '2026-06-02', plays: 3, seconds: 600 }],
      '2026-06-01',
      '2026-06-03',
    )
    expect(unit).toBe('day')
    expect(bars.map((b) => b.plays)).toEqual([0, 3, 0])
  })

  it('groups long stretches by week, then by month', () => {
    const weeks = fillDays(
      [
        { date: '2026-06-01', plays: 1, seconds: 0 },
        { date: '2026-06-03', plays: 2, seconds: 0 },
      ],
      '2026-01-01',
      '2026-12-31',
    )
    expect(weeks.unit).toBe('week')
    expect(weeks.bars.find((b) => b.key === '2026-06-01').plays).toBe(3)
    expect(fillDays([], '2020-01-01', '2026-12-31').unit).toBe('month')
  })
})

describe('helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(59 * 60)).toBe('59m')
    expect(formatDuration(3 * 3600 + 120)).toBe('3h 2m')
    expect(formatDuration(50 * 3600)).toBe('2d 2h')
  })

  it('counts days', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(toDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
