import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/cn";

type LogoutButtonProps = {
  className?: string;
  label: string;
};

export function LogoutButton({ className, label }: LogoutButtonProps) {
  return (
    <form method="post" action="/api/auth/session-logout" className={cn("w-full sm:w-auto", className)}>
      <Button type="submit" variant="secondary" className="w-full sm:w-auto">
        {label}
      </Button>
    </form>
  );
}
