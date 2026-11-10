/**
 * Hands a file to the phone's share sheet (Android: Drive, WhatsApp, email, Files…).
 * Falls back to a normal download where sharing files isn't supported (most desktops).
 * Returns 'shared', 'downloaded' or 'cancelled'.
 */
export async function shareFile(name: string, content: BlobPart, mime = 'text/csv'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([content], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Some browsers refuse at the last step; fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
