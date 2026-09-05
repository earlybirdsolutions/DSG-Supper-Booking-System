import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Redirect, Link } from 'wouter';
import { useCheckEligibility, useGetPublicConfig } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UtensilsCrossed, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@clerk/react';

const formSchema = z.object({
  email: z.string().email("Please enter a valid school email address"),
});

export default function Home() {
  const { isSignedIn } = useAuth();
  const { data: config, isLoading: isConfigLoading } = useGetPublicConfig();
  const checkEligibility = useCheckEligibility();
  
  const [eligibilityState, setEligibilityState] = useState<{
    status: 'idle' | 'success' | 'error';
    eligible?: boolean;
    message?: string;
    email?: string;
  }>({ status: 'idle' });

  // If already signed in, wouter will actually redirect to /book due to App.tsx SignedIn/SignedOut logic,
  // but just in case, we can also render a simple redirecting message.
  if (isSignedIn) {
    return <Redirect to="/book" />;
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    checkEligibility.mutate(
      { data: { email: values.email } },
      {
        onSuccess: (data) => {
          setEligibilityState({
            status: 'success',
            eligible: data.eligible,
            message: data.message,
            email: values.email,
          });
        },
        onError: (error) => {
          setEligibilityState({
            status: 'error',
            message: 'Unable to verify eligibility. Please try again later.',
          });
        }
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
            {isConfigLoading ? 'Loading...' : config?.schoolName || 'DSG Supper Booking'}
          </h1>
          <p className="text-muted-foreground text-lg">
            Day Scholar & Staff Reservation Portal
          </p>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Check Eligibility</CardTitle>
            <CardDescription>
              Enter your school email address to see if you can book supper.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eligibilityState.status === 'idle' || (eligibilityState.status === 'success' && !eligibilityState.eligible) || eligibilityState.status === 'error' ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Email</FormLabel>
                        <FormControl>
                          <Input placeholder="student@school.edu" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {eligibilityState.status === 'success' && !eligibilityState.eligible && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p data-testid="status-message">{eligibilityState.message}</p>
                    </div>
                  )}

                  {eligibilityState.status === 'error' && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p data-testid="status-message">{eligibilityState.message}</p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={checkEligibility.isPending}
                    data-testid="button-check"
                  >
                    {checkEligibility.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Check Eligibility'
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg flex items-start gap-3 border border-green-200 dark:border-green-900">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-1">You are eligible!</h3>
                    <p className="text-sm opacity-90" data-testid="status-message">{eligibilityState.message}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link href="/sign-up" className="block">
                    <Button className="w-full" size="lg" data-testid="button-signup">
                      Create an Account <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                  <div className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/sign-in" className="text-primary hover:underline font-medium data-testid:link-signin">
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
