import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';

// Pages
import Home from '@/pages/home';
import Book from '@/pages/book';
import Kitchen from '@/pages/kitchen';
import Admin from '@/pages/admin';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/book`} fallbackRedirectUrl={`${basePath}/book`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/book`} fallbackRedirectUrl={`${basePath}/book`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      client.clear();
    }
    previousUserId.current = userId;
  }), [addListener, client]);

  return null;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/">
          <Show when="signed-in"><Redirect to="/book" /></Show>
          <Show when="signed-out"><Home /></Show>
        </Route>
        
        {/* Auth Routes */}
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        
        {/* Protected Scholar Routes */}
        <Route path="/book">
          <Show when="signed-in">
            <Book />
          </Show>
          <Show when="signed-out"><Redirect to="/" /></Show>
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
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        options: {
          logoPlacement: 'inside',
          logoLinkUrl: basePath || '/',
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: '#102649',
          colorForeground: '#172033',
          colorMutedForeground: '#667085',
          colorBackground: '#fffdfa',
          colorInput: '#ffffff',
          colorInputForeground: '#172033',
          colorDanger: '#a3323a',
          colorNeutral: '#d8d5ce',
          fontFamily: 'Inter, sans-serif',
          borderRadius: '0.75rem',
        },
        elements: {
          rootBox: 'w-full flex justify-center',
          cardBox: 'bg-card rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-border',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'text-foreground font-serif',
          headerSubtitle: 'text-muted-foreground',
          formFieldLabel: 'text-foreground',
          formButtonPrimary: 'bg-primary text-primary-foreground',
          formFieldInput: 'bg-background text-foreground border-input',
          footerActionLink: 'text-primary',
          footerActionText: 'text-muted-foreground',
          dividerText: 'text-muted-foreground',
          cardBox__internal: 'bg-card',
        },
      }}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in with your school email' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Use your recognised school email' } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppWithRouter() {
  return (
    <WouterRouter base={basePath}>
      <App />
    </WouterRouter>
  );
}

export default AppWithRouter;
