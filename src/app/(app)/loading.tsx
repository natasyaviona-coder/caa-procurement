// Shown instantly on every navigation within the app while the page's data
// loads on the server — so tab switches feel immediate instead of frozen.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted/70" />
      </div>
      <div className="h-9 w-full max-w-sm rounded-md bg-muted" />
      <div className="space-y-px overflow-hidden rounded-md border">
        <div className="h-10 bg-muted/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 border-t bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
