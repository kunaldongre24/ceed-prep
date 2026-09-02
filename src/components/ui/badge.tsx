import * as React from "react"
const variants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border text-foreground",
  success: "bg-emerald-500 text-white",
  warning: "bg-amber-500 text-white",
} as const
export const Badge = ({ variant = "default", className = "", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants }) => (
  <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`} {...props} />
)