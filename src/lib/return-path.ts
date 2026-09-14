export function safeReturnPath(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\/(groups\/[a-z0-9]+(?:-[a-z0-9]+)*|my-groups|admin|experiments)$/.test(
      value,
    )
    ? value
    : undefined;
}
