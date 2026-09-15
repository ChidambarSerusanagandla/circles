export function safeReturnPath(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\/(groups\/[a-z0-9]+(?:-[a-z0-9]+)*|groups|my-groups|inbox|creator|admin)$/.test(
      value,
    )
    ? value
    : undefined;
}
