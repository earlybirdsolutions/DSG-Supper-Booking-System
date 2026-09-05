import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfDay } from 'date-fns';
import { 
  useGetAdminSettings, 
  useUpdateAdminSettings,
  useListStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useListAllBookings,
  getGetAdminSettingsQueryKey,
  getListStudentsQueryKey
} from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch as UISwitch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Search, MoreVertical, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// --- Sub-components ---

function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  
  const [cutoffTime, setCutoffTime] = useState('');
  const [summaryTime, setSummaryTime] = useState('');
  
  // Use initialized ref pattern for data fetching
  const initialized = useRef(false);
  
  useEffect(() => {
    if (settings && !initialized.current) {
      setCutoffTime(settings.cutoffTime);
      setSummaryTime(settings.summaryTime);
      initialized.current = true;
    }
  }, [settings]);

  const handleSave = () => {
    if (!settings) return;
    
    updateSettings.mutate(
      { 
        data: {
          cutoffTime,
          summaryTime,
          kitchenEmails: settings.kitchenEmails,
          financeEmails: settings.financeEmails,
          adminEmails: settings.adminEmails
        } 
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetAdminSettingsQueryKey(), updated);
          toast({ title: 'Settings saved successfully' });
        },
        onError: (err: any) => {
          toast({ title: 'Failed to save settings', description: err.message, variant: 'destructive' });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-serif font-bold">System Settings</h2>
        <p className="text-muted-foreground mt-1">Configure global booking rules.</p>
      </div>

      <Card className="shadow-sm max-w-2xl">
        <CardHeader>
          <CardTitle>Time Configuration</CardTitle>
          <CardDescription>Set the daily deadlines for supper operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cutoffTime">Booking Cutoff Time</Label>
            <Input 
              id="cutoffTime"
              type="time" 
              value={cutoffTime}
              onChange={(e) => setCutoffTime(e.target.value)}
              className="max-w-xs"
              data-testid="input-cutoff-time"
            />
            <p className="text-sm text-muted-foreground">Scholars cannot book for today after this time.</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="summaryTime">Daily Summary Email Time</Label>
            <Input 
              id="summaryTime"
              type="time" 
              value={summaryTime}
              onChange={(e) => setSummaryTime(e.target.value)}
              className="max-w-xs"
              data-testid="input-summary-time"
            />
            <p className="text-sm text-muted-foreground">When the final kitchen numbers are emailed.</p>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t p-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateSettings.isPending} data-testid="button-save-settings">
            {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
      
      <Card className="shadow-sm max-w-2xl opacity-75">
        <CardHeader>
          <CardTitle>Mailing Lists</CardTitle>
          <CardDescription>Manage who receives system emails (Kitchen, Finance, Admins). Configure these via API for now.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Kitchen Emails</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {settings?.kitchenEmails.map((email, i) => (
                  <Badge key={i} variant="secondary">{email}</Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Finance Emails</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {settings?.financeEmails.map((email, i) => (
                  <Badge key={i} variant="secondary">{email}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


const studentFormSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  grade: z.string().optional(),
  active: z.boolean().default(true),
});

function StudentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useListStudents();
  
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null); // email
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // email

  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { email: '', name: '', grade: '', active: true }
  });

  const editForm = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
  });

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const lowerSearch = search.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(lowerSearch) || 
      s.email.toLowerCase().includes(lowerSearch) ||
      (s.grade && s.grade.toLowerCase().includes(lowerSearch))
    );
  }, [students, search]);

  const onAddSubmit = (values: z.infer<typeof studentFormSchema>) => {
    createStudent.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: 'Student added successfully' });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to add student', description: err.message, variant: 'destructive' });
      }
    });
  };

  const onEditSubmit = (values: z.infer<typeof studentFormSchema>) => {
    updateStudent.mutate({ email: values.email, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setEditingStudent(null);
        toast({ title: 'Student updated successfully' });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to update student', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleDelete = (email: string) => {
    deleteStudent.mutate({ email }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setDeleteConfirm(null);
        toast({ title: 'Student removed successfully' });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to remove student', description: err.message, variant: 'destructive' });
      }
    });
  };

  const openEdit = (email: string) => {
    const student = students?.find(s => s.email === email);
    if (student) {
      editForm.reset({
        email: student.email,
        name: student.name,
        grade: student.grade || '',
        active: student.active
      });
      setEditingStudent(email);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold">Student Whitelist</h2>
          <p className="text-muted-foreground mt-1">Manage which students are eligible to book suppers.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-student">
              <Plus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Eligible Student</DialogTitle>
              <DialogDescription>Add a student email to the whitelist.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="student@school.edu" {...field} data-testid="input-student-email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} data-testid="input-student-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="grade" render={({ field }) => (
                  <FormItem><FormLabel>Grade (Optional)</FormLabel><FormControl><Input placeholder="11" {...field} data-testid="input-student-grade" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <UISwitch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={createStudent.isPending} data-testid="button-submit-student">
                    {createStudent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Student
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search by name or email..." 
              className="pl-8" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-students"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">No students found.</div>
          ) : (
            <div className="divide-y">
              {filteredStudents.map(student => (
                <div key={student.email} className="flex items-center justify-between p-4 hover:bg-muted/20" data-testid={`student-row-${student.email}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{student.name}</p>
                      {!student.active && <Badge variant="secondary" className="text-xs bg-muted">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span>{student.email}</span>
                      {student.grade && <span>• Grade {student.grade}</span>}
                    </div>
                  </div>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-student-actions-${student.email}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(student.email)} data-testid="action-edit-student">
                          <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => setDeleteConfirm(student.email)}
                          data-testid="action-delete-student"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove from whitelist
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email (Cannot be changed)</FormLabel><FormControl><Input {...field} disabled /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="grade" render={({ field }) => (
                <FormItem><FormLabel>Grade (Optional)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active Status</FormLabel>
                    <p className="text-sm text-muted-foreground">Inactive students cannot book.</p>
                  </div>
                  <FormControl>
                    <UISwitch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
                <Button type="submit" disabled={updateStudent.isPending}>
                  {updateStudent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Student
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Student?</DialogTitle>
            <DialogDescription>
              This will prevent <strong>{deleteConfirm}</strong> from making future bookings. Their past bookings will remain in the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteStudent.isPending}>
              {deleteStudent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Yes, Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingsPage() {
  const [dateRange, setDateRange] = useState<'today' | 'upcoming' | 'all'>('upcoming');
  const { data: bookings, isLoading } = useListAllBookings({});

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    
    let filtered = bookings.filter(b => b.status === 'confirmed');
    
    if (dateRange === 'today') {
      const today = startOfDay(new Date());
      filtered = filtered.filter(b => startOfDay(parseISO(b.bookingDate)).getTime() === today.getTime());
    } else if (dateRange === 'upcoming') {
      const today = startOfDay(new Date());
      filtered = filtered.filter(b => startOfDay(parseISO(b.bookingDate)).getTime() >= today.getTime());
    }
    
    // Sort descending by date
    return filtered.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  }, [bookings, dateRange]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold">All Bookings</h2>
          <p className="text-muted-foreground mt-1">Audit log of student reservations.</p>
        </div>
        
        <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today's Bookings</SelectItem>
            <SelectItem value="upcoming">Upcoming Bookings</SelectItem>
            <SelectItem value="all">All History</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">No bookings found for this filter.</div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map(booking => (
                <div key={booking.id} className="flex items-center justify-between p-4 hover:bg-muted/10">
                  <div>
                    <p className="font-medium text-foreground">{booking.studentName}</p>
                    <p className="text-sm text-muted-foreground">{booking.studentEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{format(parseISO(booking.bookingDate), 'MMM d, yyyy')}</p>
                    <p className="text-xs text-muted-foreground">Booked: {format(parseISO(booking.createdAt), 'MMM d HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export default function Admin() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={SettingsPage} />
        <Route path="/admin/students" component={StudentsPage} />
        <Route path="/admin/bookings" component={BookingsPage} />
      </Switch>
    </AdminLayout>
  );
}
