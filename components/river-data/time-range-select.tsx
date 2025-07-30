"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

// Updated to include lake-specific time ranges
export type TimeRangeOption = "1h" | "2h" | "6h" | "12h" | "24h" | "48h" | "1w" | "2w" | "4w" | "3m" | "6m"

interface TimeRangeSelectProps {
  value: TimeRangeOption
  onValueChange: (value: TimeRangeOption) => void
  isLake?: boolean // New prop to determine if showing lake options
}

// River time range options (existing)
export const riverTimeRangeOptions = [
  { value: "1h", label: "1 Stunde" },
  { value: "2h", label: "2 Stunden" },
  { value: "6h", label: "6 Stunden" },
  { value: "12h", label: "12 Stunden" },
  { value: "24h", label: "24 Stunden" },
  { value: "48h", label: "48 Stunden" },
  { value: "1w", label: "1 Woche" },
] as const

// Lake time range options (for Spitzingsee)
export const lakeTimeRangeOptions = [
  { value: "1w", label: "1 Woche" },
  { value: "2w", label: "2 Wochen" },
  { value: "4w", label: "4 Wochen" },
  { value: "3m", label: "3 Monate" },
  { value: "6m", label: "6 Monate" },
] as const

// Keep backward compatibility
export const timeRangeOptions = riverTimeRangeOptions

export function TimeRangeSelect({ value, onValueChange, isLake = false }: TimeRangeSelectProps) {
  // Choose options based on whether it's a lake or river
  const options = isLake ? lakeTimeRangeOptions : riverTimeRangeOptions

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
