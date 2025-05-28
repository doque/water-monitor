import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function RiverDataSkeleton() {
  // Create an array with 4 elements for the rivers
  const rivers = Array(4).fill(null)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="river-1">
        <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${rivers.length}, minmax(0, 1fr))` }}>
          {rivers.map((_, index) => (
            <TabsTrigger key={`river-${index + 1}`} value={`river-${index + 1}`}>
              <Skeleton className="h-4 w-32" />
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="river-1">
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Flow Card Skeleton */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Abfluss</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>

              {/* Level Card Skeleton */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Pegel</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>

              {/* Temperature Card Skeleton */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Temperatur</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            </div>

            {/* Chart Area Skeleton */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle>Entwicklung</CardTitle>
                    <Skeleton className="h-4 w-32 ml-2" />
                  </div>
                  <Skeleton className="h-8 w-40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full rounded-md animate-pulse bg-muted" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center">
        Datenquellen: Hochwassernachrichtendienst Bayern und Niedrigwasser-Informationsdienst Bayern
      </div>
    </div>
  )
}
