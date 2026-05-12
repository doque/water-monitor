"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RiverDataSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Selectors skeleton */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4">
        <div className="col-span-7 sm:col-span-6">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="col-span-5 sm:col-span-6">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Unified chart skeleton */}
      <Card>
        <CardHeader className="border-b p-0">
          <div className="grid grid-cols-3">
            {[1, 2, 3].map((i, index) => (
              <div
                key={i}
                className={`flex flex-col justify-center gap-1 px-3 py-3 border-r last:border-r-0 sm:px-4 sm:py-4 ${index === 0 ? "bg-background shadow-[inset_0_-2px_0_0_hsl(var(--primary))]" : ""}`}
              >
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-14 sm:h-6 sm:w-16" />
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-1.5 pb-4 sm:px-6 sm:pt-2 sm:pb-6">
          <div className="flex justify-end -mb-4 relative z-10 pr-2 h-[18px]">
            <Skeleton className="h-4 w-20 sm:w-24" />
          </div>
          <Skeleton className="h-[250px] sm:h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
