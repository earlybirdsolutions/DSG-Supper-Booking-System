import { Link } from "wouter";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Page Not Found
          </h1>
          <p className="mt-2 text-muted-foreground">
            We couldn't find the page you were looking for.
          </p>
        </div>
        <Link href="/">
          <Button variant="default">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
