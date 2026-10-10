export function localizedMutationPaths(locale: string, returnTo: string) {
  const normalizedPath = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
  const returnPath = normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;

  return Array.from(new Set([returnPath, `/${locale}`]));
}
