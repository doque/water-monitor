"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

// Updated to include lake-specific time ranges
export type TimeRangeOption = "1h" | "2h" | "6h" | "12h" | "24h" | "48h" | "1w" | "2w" | "1m" | "2m" | "6m"

export const timeRangeDurationDays: Record<TimeRangeOption, number> = {
  "1h": 1 / 24,
  "2h": 2 / 24,
  "6h": 6 / 24,
  "12h": 12 / 24,
  "24h": 1,
  "48h": 2,
  "1w": 7,
  "2w": 14,
  "1m": 30,
  "2m": 60,
  "6m": 180,
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
  // New prop to determine if this is for a lake
  isLake?: boolean
  lakeName?: string
  filteredOptions?: readonly { value: TimeRangeOption; label: string }[]
}

// River time range options (original)
export const riverTimeRangeOptions = [
  { value: "1h", label: "1 Stunde" },
  { value: "2h", label: "2 Stunden" },
  { value: "6h", label: "6 Stunden" },
  { value: "12h", label: "12 Stunden" },
  { value: "24h", label: "24 Stunden" },
  { value: "48h", label: "48 Stunden" },
  { value: "1w", label: "1 Woche" },
] as const

// Lake time range options (new)
export const lakeTimeRangeOptions = [
  { value: "1w", label: "1 Woche" },
  { value: "2w", label: "2 Wochen" },
  { value: "1m", label: "1 Monat" },
  { value: "2m", label: "2 Monate" },
  { value: "6m", label: "6 Monate" },
] as const

// Spitzingsee-specific options (includes 6 months)
export const spitzingseeTimeRangeOptions = lakeTimeRangeOptions

// Other lakes options (no 6 months)
export const otherLakeTimeRangeOptions = [
  { value: "1w", label: "1 Woche" },
  { value: "2w", label: "2 Wochen" },
  { value: "1m", label: "1 Monat" },
  { value: "2m", label: "2 Monate" },
] as const

export function TimeRangeSelect({ value, onValueChange, isLake, lakeName, filteredOptions }: TimeRangeSelectProps) {
  // Determine which options to use based on water body type
  const baseOptions = isLake
    ? lakeName === "Spitzingsee"
      ? spitzingseeTimeRangeOptions
      : otherLakeTimeRangeOptions
    : riverTimeRangeOptions

  const options = filteredOptions !== undefined ? filteredOptions : baseOptions

  // Find the selected option to display its label
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
