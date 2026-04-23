export function formatEmailSubject(subject: string): string {
  if (!subject.trim()) return "(no subject)";
  return subject.trim();
}
