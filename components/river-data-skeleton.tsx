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
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col justify-center gap-1 px-3 py-3 border-r last:border-r-0 sm:px-4 sm:py-4"
              >
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-14 sm:h-6 sm:w-16" />
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-2 pb-4 sm:px-6 sm:pt-3 sm:pb-6">
          <div className="h-[250px] sm:h-[300px] w-full relative">
            <Skeleton className="absolute top-0 right-0 h-4 w-24 sm:w-28" />
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
