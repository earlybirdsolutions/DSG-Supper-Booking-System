import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';

// Pages
import Home from '@/pages/home';
import Book from '@/pages/book';
import Kitchen from '@/pages/kitchen';
import Admin from '@/pages/admin';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

function AuthRoutes() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Switch>
        <Route path="/sign-in">
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/book" fallbackRedirectUrl="/book" />
        </Route>
        <Route path="/sign-up">
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/book" fallbackRedirectUrl="/book" />
        </Route>
      </Switch>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        
        {/* Auth Routes */}
        <Route path="/sign-in" component={AuthRoutes} />
        <Route path="/sign-up" component={AuthRoutes} />
        
        {/* Protected Scholar Routes */}
        <Route path="/book">
          <SignedIn>
            <Book />
          </SignedIn>
          <SignedOut>
            <Home />
          </SignedOut>
        </Route>
        
        {/* Kitchen Routes (Staff) */}
        <Route path="/kitchen">
          <Kitchen />
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin">
          <Admin />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={CLERK_KEY} appearance={{
        variables: {
          colorPrimary: '#0f2040',
          colorBackground: '#ffffff',
          colorText: '#1a1a1a',
        },
        elements: {
          card: "shadow-lg rounded-xl border border-border",
        }
      }}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ClerkProvider>
    </QueryClientProvider>
  );
}

export default App;
