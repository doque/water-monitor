import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RiverDataSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* River and Time Range Selection Skeleton */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 sm:col-span-6">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="col-span-5 sm:col-span-6">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-4">
          {/* Desktop layout: Flow, Level, and Temperature in a row above the chart */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {/* Flow Card Skeleton */}
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-32" />
              </CardContent>
            </Card>

            {/* Level Card Skeleton */}
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-24" />
              </CardContent>
            </Card>

            {/* Temperature Card Skeleton */}
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-28" />
              </CardContent>
            </Card>
          </div>

          {/* Mobile layout: Only Flow card above the chart */}
          <div className="md:hidden">
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Abfluss</CardTitle>
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-32" />
              </CardContent>
            </Card>
          </div>

          {/* Chart Area Skeleton */}
          <Card>
            <CardHeader className="pb-2 p-3 sm:p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base sm:text-lg">Entwicklung</CardTitle>
                <Skeleton className="h-4 w-20" />
              </div>
            </CardHeader>
            <CardContent className="p-1 sm:p-3">
              <div className="h-[300px] w-full">
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Mobile layout: Level and Temperature cards below the chart */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Pegel</CardTitle>
                </div>
                <div className="text-sm font-normal mt-1">
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-20" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 p-3 sm:p-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base sm:text-lg">Temperatur</CardTitle>
                </div>
                <div className="text-sm font-normal mt-1">
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Skeleton className="h-12 w-24" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Data Sources Footer Skeleton */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <Skeleton className="h-3 w-96 mx-auto" />
        <Skeleton className="h-3 w-80 mx-auto" />
      </div>
    </div>
  )
}
