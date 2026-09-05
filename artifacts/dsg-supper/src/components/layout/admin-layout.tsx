import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ChefHat, Settings, Users, CalendarDays, UtensilsCrossed, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminLayout({ children, isKitchen = false }: { children: ReactNode; isKitchen?: boolean }) {
  const [location] = useLocation();

  const navItems = isKitchen 
    ? [
        { label: 'Live Kitchen', href: '/kitchen', icon: ChefHat },
        { label: 'Exit to Admin', href: '/admin', icon: ArrowLeft },
      ]
    : [
        { label: 'Settings', href: '/admin', icon: Settings },
        { label: 'Students', href: '/admin/students', icon: Users },
        { label: 'All Bookings', href: '/admin/bookings', icon: CalendarDays },
        { label: 'Kitchen View', href: '/kitchen', icon: UtensilsCrossed },
      ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border flex-shrink-0 md:h-[100dvh] md:sticky md:top-0 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
              {isKitchen ? <ChefHat className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
            </div>
            <span className="font-serif font-semibold text-lg text-primary">
              {isKitchen ? 'Kitchen' : 'Admin'}
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 min-w-0">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
