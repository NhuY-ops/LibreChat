import type { TFile } from 'librechat-data-provider';
import { filterIndexedFiles, normalizeKnowledgeTag } from './knowledgeFiles';

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

  it('preserves two indexed uploads with the same filename but different file IDs', () => {
    const duplicates = [
      { file_id: 'first-file', filename: 'research.txt', embedded: true },
      { file_id: 'second-file', filename: 'research.txt', embedded: true },
    ] as TFile[];
    expect(filterIndexedFiles(duplicates).map((file) => file.file_id)).toEqual([
      'first-file',
      'second-file',
    ]);
  });

  it('returns an empty list for unknown queries', () => {
    expect(filterIndexedFiles(files, 'missing')).toEqual([]);
  });
});

describe('normalizeKnowledgeTag', () => {
  it('normalizes whitespace, case, and Unicode', () => {
    expect(normalizeKnowledgeTag('  Medical Research  ')).toBe('medical research');
    expect(normalizeKnowledgeTag(' Miễn dịch ')).toBe('miễn dịch');
    expect(normalizeKnowledgeTag('Ｆｉｌｅ')).toBe('file');
  });
});
