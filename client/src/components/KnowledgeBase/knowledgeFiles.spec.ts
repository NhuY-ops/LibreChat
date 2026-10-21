import type { TFile } from 'librechat-data-provider';
import { filterIndexedFiles } from './knowledgeFiles';

describe('filterIndexedFiles', () => {
  const files = [
    { file_id: 'a', filename: 'Nursing Notes.pdf', embedded: true },
    { file_id: 'b', filename: 'Unprocessed.docx', embedded: false },
    { file_id: 'c', filename: 'Research Paper.pdf', embedded: true },
    { file_id: 'd', filename: 'Legacy.txt' },
  ] as TFile[];

  it('only shows files that the RAG backend marked indexed', () => {
    expect(filterIndexedFiles(files).map((file) => file.file_id)).toEqual(['a', 'c']);
  });

  it('filters indexed files by case-insensitive filename without mutating the source', () => {
    expect(filterIndexedFiles(files, ' NURSING ').map((file) => file.file_id)).toEqual(['a']);
    expect(files).toHaveLength(4);
  });

  it('returns an empty list for unknown queries', () => {
    expect(filterIndexedFiles(files, 'missing')).toEqual([]);
  });
});
