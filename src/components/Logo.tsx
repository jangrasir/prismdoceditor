import { Triangle } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 font-display ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
        <Triangle className="h-4 w-4 text-primary-foreground" fill="currentColor" />
      </span>
      <span className="text-xl font-bold tracking-tight">Prism</span>
    </Link>
  );
}
