export function appUrl(path: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\//, ''), base).href;
}
