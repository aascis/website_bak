import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "xl";
}

export function Spinner({ className, size = "default" }: SpinnerProps) {
  const sizeClasses = {
    default: "h-6 w-6",
    sm: "h-4 w-4",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  return (
    <Loader2 
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )} 
    />
  );
}