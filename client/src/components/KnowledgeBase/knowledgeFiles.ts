import type { TFile } from 'librechat-data-provider';

/**
 * The current RAG backend marks searchable files with embedded=true.
 * This is a read-only inventory of the signed-in user's existing files,
 * NOT a newly created shared KB or a promise that every upload is indexed.
 */
export function filterIndexedFiles(files: readonly TFile[], query = ''): TFile[] {
  const search = query.trim().toLocaleLowerCase();
  return files.filter(
    (file) =>
      file.embedded === true &&
      (!search || (file.filename ?? '').toLocaleLowerCase().includes(search)),
  );
}
