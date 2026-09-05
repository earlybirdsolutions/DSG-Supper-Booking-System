import { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { useGetKitchenDashboard, getGetKitchenDashboardQueryKey } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, ChevronLeft, ChevronRight, UtensilsCrossed, RefreshCw, Printer } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Kitchen() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  
  const { data, isLoading, refetch, isRefetching } = useGetKitchenDashboard(
    { date: dateStr },
    { query: { refetchInterval: 60000, queryKey: getGetKitchenDashboardQueryKey({ date: dateStr }) } } // 60s freshness
  );

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout isKitchen>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Live Kitchen List</h1>
            <p className="text-muted-foreground mt-1">Real-time supper count and list.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrevDay} data-testid="button-prev-day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input 
              type="date" 
              value={dateStr}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="w-auto h-9"
              data-testid="input-date"
            />
            <Button variant="outline" size="icon" onClick={handleNextDay} data-testid="button-next-day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="flex items-center justify-center h-64 border rounded-xl bg-card/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 print:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 shadow-sm border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Total Suppers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-6xl font-serif font-bold text-primary mb-2 flex items-baseline gap-2">
                    {data?.count || 0}
                    <UtensilsCrossed className="w-8 h-8 text-primary/40" />
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    {data?.cutoffPassed ? (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0">
                        Cutoff Passed ({data.cutoffTime})
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-0 dark:bg-green-900/30 dark:text-green-400">
                        Booking Open (until {data?.cutoffTime})
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 shadow-sm flex flex-col justify-center p-6 bg-card border-border print:hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Kitchen Actions</h3>
                    <p className="text-sm text-muted-foreground">Updated every 60 seconds automatically.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} data-testid="button-refresh">
                      <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button onClick={handlePrint} data-testid="button-print">
                      <Printer className="w-4 h-4 mr-2" />
                      Print List
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Scholar List - {data?.displayDate}</CardTitle>
                <CardDescription>All confirmed bookings for this date.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                {!data?.bookings || data.bookings.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-muted-foreground">No bookings for this date.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {data.bookings.map((booking, index) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-8 text-center text-sm font-medium text-muted-foreground">
                            {index + 1}.
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{booking.studentName}</p>
                            <p className="text-sm text-muted-foreground">{booking.studentEmail}</p>
                          </div>
                        </div>
                        {booking.grade && (
                          <Badge variant="outline" className="font-mono text-xs">
                            Grade {booking.grade}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 1cm; }
          body { -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:space-y-4 > * + * { margin-top: 1rem; }
        }
      `}} />
    </AdminLayout>
  );
}
