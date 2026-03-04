"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

export type TimeRangeOption = "1h" | "6h" | "12h" | "24h" | "2d" | "1w" | "2w" | "1m" | "3m" | "6m" | "12m" | "24m"

export const timeRangeDurationDays: Record<TimeRangeOption, number> = {
  "1h":  1 / 24,
  "6h":  6 / 24,
  "12h": 12 / 24,
  "24h": 1,
  "2d":  2,
  "1w":  7,
  "2w":  14,
  "1m":  30,
  "3m":  90,
  "6m":  180,
  "12m": 365,
  "24m": 730,
}

const DATA_SPAN_MULTIPLIER = 1.5

export function filterTimeRangeOptions<T extends { value: TimeRangeOption }>(
  baseOptions: readonly T[],
  spanDays: number
): T[] {
  const max = spanDays * DATA_SPAN_MULTIPLIER
  const filtered = baseOptions.filter(o => timeRangeDurationDays[o.value] <= max)
  return filtered.length > 0 ? filtered : [baseOptions[0]]
}

interface TimeRangeSelectProps {
  value: TimeRangeOption
  onValueChange: (value: TimeRangeOption) => void
  isLake?: boolean
  lakeName?: string
  filteredOptions?: readonly { value: TimeRangeOption; label: string }[]
}

export const riverTimeRangeOptions = [
  { value: "1h",  label: "1 Stunde" },
  { value: "6h",  label: "6 Stunden" },
  { value: "12h", label: "12 Stunden" },
  { value: "24h", label: "24 Stunden" },
  { value: "2d",  label: "2 Tage" },
  { value: "1w",  label: "1 Woche" },
  { value: "2w",  label: "2 Wochen" },
  { value: "1m",  label: "1 Monat" },
  { value: "3m",  label: "3 Monate" },
  { value: "6m",  label: "6 Monate" },
  { value: "12m", label: "12 Monate" },
  { value: "24m", label: "24 Monate" },
] as const

export const lakeTimeRangeOptions = [
  { value: "1w",  label: "1 Woche" },
  { value: "2w",  label: "2 Wochen" },
  { value: "1m",  label: "1 Monat" },
  { value: "3m",  label: "3 Monate" },
  { value: "6m",  label: "6 Monate" },
  { value: "12m", label: "12 Monate" },
  { value: "24m", label: "24 Monate" },
] as const

// GKD data available for ranges > 1 week
export const GKD_RANGES = new Set<TimeRangeOption>(["2w", "1m", "3m", "6m", "12m", "24m"])

export function TimeRangeSelect({ value, onValueChange, isLake, filteredOptions }: TimeRangeSelectProps) {
  const baseOptions = isLake ? lakeTimeRangeOptions : riverTimeRangeOptions
  const options = filteredOptions !== undefined ? filteredOptions : baseOptions
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Select value={value} onValueChange={(value) => onValueChange(value as TimeRangeOption)}>
      <SelectTrigger className="px-2 h-10 flex items-center justify-between">
        <div className="truncate">{selectedOption?.label || "Zeitraum wählen"}</div>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
