"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

export type TimeRangeOption = "1h" | "2h" | "6h" | "12h" | "24h" | "48h" | "1w"

interface TimeRangeSelectProps {
  value: TimeRangeOption
  onValueChange: (value: TimeRangeOption) => void
}

export const timeRangeOptions = [
  { value: "1h", label: "1 Stunde" },
  { value: "2h", label: "2 Stunden" },
  { value: "6h", label: "6 Stunden" },
  { value: "12h", label: "12 Stunden" },
  { value: "24h", label: "24 Stunden" },
  { value: "48h", label: "48 Stunden" },
  { value: "1w", label: "1 Woche" },
]

export function TimeRangeSelect({ value, onValueChange }: TimeRangeSelectProps) {
  // Find the selected option to display its label
  const selectedOption = timeRangeOptions.find((option) => option.value === value)

  return (
    <Select value={value} onValueChange={(value) => onValueChange(value as TimeRangeOption)}>
      <SelectTrigger className="px-2 h-10 flex items-center justify-between">
        <div className="truncate">{selectedOption?.label || "Zeitraum wählen"}</div>
      </SelectTrigger>
      <SelectContent>
        {timeRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
