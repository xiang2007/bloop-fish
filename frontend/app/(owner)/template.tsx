// Remounts on every navigation between owner pages, so each page eases in.
// Switching tabs within a page only changes the query string and keeps it.
export default function OwnerTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
