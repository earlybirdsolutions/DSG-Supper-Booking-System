import { useState, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isAfter, isToday, isTomorrow, parseISO, addDays, startOfDay } from 'date-fns';
import { 
  useGetCurrentScholar, 
  useListScholarBookings, 
  useCreateBooking, 
  useCancelBooking,
  useGetPublicConfig,
  getListScholarBookingsQueryKey,
  getGetCurrentScholarQueryKey
} from '@workspace/api-client-react';
import { StudentLayout } from '@/components/layout/student-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Loader2, AlertCircle, X, Check, Info, UtensilsCrossed } from 'lucide-react';

export default function Book() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: config } = useGetPublicConfig();
  const { data: scholar, isLoading: isScholarLoading } = useGetCurrentScholar();
  const { data: bookings, isLoading: isBookingsLoading } = useListScholarBookings();
  
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);

  // Format timezone string properly if needed, but for simplicity we rely on local time mapping
  const cutoffTime = config?.cutoffTime || "14:00"; 
  const now = new Date();
  
  // A date is bookable if:
  // 1. It is today and before cutoff time
  // 2. It is tomorrow or later
  const isBookable = (date: Date) => {
    const today = startOfDay(new Date());
    const targetDate = startOfDay(date);
    
    if (targetDate < today) return false;
    
    if (targetDate.getTime() === today.getTime()) {
      // Check cutoff
      const [hours, minutes] = cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(hours, minutes, 0, 0);
      return now < cutoffDate;
    }
    
    return true;
  };

  const handleBook = () => {
    if (!selectedDate) return;
    
    // Format as YYYY-MM-DD
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    createBooking.mutate(
      { data: { bookingDate: dateStr } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScholarBookingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentScholarQueryKey() });
          setIsBookingDialogOpen(false);
          toast({
            title: "Booking confirmed",
            description: `Your supper for ${format(selectedDate, 'MMMM d')} has been booked.`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Booking failed",
            description: error.message || "Failed to book supper.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleCancel = (id: number) => {
    cancelBooking.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScholarBookingsQueryKey() });
          setBookingToCancel(null);
          toast({
            title: "Booking cancelled",
            description: "Your supper booking has been cancelled.",
          });
        },
        onError: (error: any) => {
          toast({
            title: "Cancellation failed",
            description: error.message || "Failed to cancel booking.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const activeBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings
      .filter(b => b.status === 'confirmed')
      .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
  }, [bookings]);

  // Generate booked dates for calendar highlighting
  const bookedDates = useMemo(() => {
    return activeBookings.map(b => parseISO(b.bookingDate));
  }, [activeBookings]);

  if (isScholarLoading || isBookingsLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  if (!scholar?.eligible) {
    return (
      <StudentLayout>
        <Card className="border-destructive">
          <CardHeader className="bg-destructive/5">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Not Eligible
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p>Your account is not currently whitelisted for supper bookings. If you believe this is an error, please contact the administration.</p>
          </CardContent>
        </Card>
      </StudentLayout>
    );
  }

  const selectedIsBooked = selectedDate && bookedDates.some(d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));
  const selectedIsBookable = selectedDate && isBookable(selectedDate);
  
  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Welcome, {scholar.name || scholar.email.split('@')[0]}</h1>
          <p className="text-muted-foreground mt-1">Book your suppers below. Same-day bookings close at {config?.cutoffTime || '14:00'}.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Select Date</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                  modifiers={{
                    booked: bookedDates
                  }}
                  modifiersStyles={{
                    booked: {
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))'
                    }
                  }}
                  className="rounded-md border-0"
                  data-testid="calendar-booking"
                />
              </CardContent>
              <CardFooter className="bg-muted/50 border-t p-4 flex-col gap-3">
                {!selectedDate ? (
                  <p className="text-sm text-center text-muted-foreground w-full">Select a date to book</p>
                ) : selectedIsBooked ? (
                  <div className="w-full text-center">
                    <p className="text-sm font-medium text-primary mb-2 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Already booked
                    </p>
                  </div>
                ) : !selectedIsBookable ? (
                  <div className="w-full text-center space-y-2">
                    <p className="text-sm text-destructive flex items-center justify-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Cutoff time passed
                    </p>
                    <p className="text-xs text-muted-foreground">Bookings for today closed at {cutoffTime}.</p>
                  </div>
                ) : (
                  <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" data-testid="button-initiate-booking">
                        Book for {format(selectedDate, 'MMM d')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Supper Booking</DialogTitle>
                        <DialogDescription>
                          You are booking supper for <strong>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>Cancel</Button>
                        <Button 
                          onClick={handleBook} 
                          disabled={createBooking.isPending}
                          data-testid="button-confirm-booking"
                        >
                          {createBooking.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Confirm Booking
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardFooter>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="h-full shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Upcoming Bookings
                </CardTitle>
                <CardDescription>
                  Your confirmed supper reservations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeBookings.length === 0 ? (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-lg bg-muted/20">
                    <UtensilsCrossed className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <h3 className="text-lg font-medium text-foreground mb-1">No upcoming suppers</h3>
                    <p className="text-sm text-muted-foreground">Use the calendar to book your meals.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBookings.map((booking) => {
                      const date = parseISO(booking.bookingDate);
                      const isPastCutoff = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && !isBookable(date);
                      
                      return (
                        <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/10 transition-colors" data-testid={`booking-row-${booking.id}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <div className="font-medium text-foreground">
                              {isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : format(date, 'EEEE')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(date, 'MMMM d, yyyy')}
                            </div>
                          </div>
                          
                          <div>
                            {isPastCutoff ? (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-locked-${booking.id}`}>Locked</Badge>
                            ) : (
                              <Dialog 
                                open={bookingToCancel === booking.id} 
                                onOpenChange={(open) => setBookingToCancel(open ? booking.id : null)}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-cancel-${booking.id}`}>
                                    <X className="w-4 h-4 mr-1" /> Cancel
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Cancel Booking?</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to cancel your supper for <strong>{format(date, 'MMMM d')}</strong>?
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="mt-4">
                                    <Button variant="outline" onClick={() => setBookingToCancel(null)}>Keep Booking</Button>
                                    <Button 
                                      variant="destructive" 
                                      onClick={() => handleCancel(booking.id)}
                                      disabled={cancelBooking.isPending}
                                      data-testid="button-confirm-cancel"
                                    >
                                      {cancelBooking.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                      Yes, Cancel it
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
