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
        <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-4 sm:px-6 sm:py-5 border-b sm:border-b-0">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-1 flex-col justify-center gap-1 border-t px-3 py-3 even:border-l sm:border-l sm:border-t-0 sm:px-6 sm:py-4"
              >
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-6 w-16 sm:h-8 sm:w-20" />
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-2 py-4 sm:p-6 sm:pt-4">
          <Skeleton className="h-[250px] sm:h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
