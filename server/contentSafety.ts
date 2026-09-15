/** Defense in depth, not a guarantee of detecting every secret in arbitrary prose.
 * Connection credentials never enter this content pipeline at all.
 */
export function assertNoCredentials(value: unknown): void {
  if (typeof value === "string") {
    if (
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[\w.-]{12,}|\b(?:sk-|gh[pousr]_|github_pat_)[\w-]{16,}|\b(?:password|api[_-]?key|bootstrap[_-]?token|access[_-]?token|refresh[_-]?token)\s*[=:]\s*["']?[^\s"']{8,}/i.test(
        value,
      )
    )
      throw new Error(
        "Possible credential material detected. Remove secrets before saving local content.",
      );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentials);
    return;
  }
  if (value && typeof value === "object")
    Object.values(value).forEach(assertNoCredentials);
}
