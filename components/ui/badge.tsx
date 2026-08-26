import { StatusDot } from '@/components/admin-shell'

export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'error'
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
        tone === 'success'
          ? 'bg-primary/10 text-primary'
          : tone === 'warning'
            ? 'bg-accent/20 text-accent-foreground'
            : tone === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
      }`}
    >
      <StatusDot
        color={
          tone === 'success'
            ? 'bg-primary'
            : tone === 'warning'
              ? 'bg-accent-foreground'
              : tone === 'error'
                ? 'bg-destructive'
                : 'bg-muted-foreground'
        }
      />
      {children}
    </span>
  )
}
