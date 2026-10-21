import { Constants } from 'librechat-data-provider';
import { MINE_AGENT_TEMPLATES, MINE_RESEARCH_V1_INSTRUCTIONS } from './mineAgentTemplates';

describe('MINE Agent starter templates', () => {
  it('ships distinct and complete Agent blueprints', () => {
    const ids = MINE_AGENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['general', 'research', 'marketing', 'coding', 'learning']));
    for (const template of MINE_AGENT_TEMPLATES) {
      expect(template.name.trim()).not.toBe('');
      expect(template.description.trim()).not.toBe('');
      expect(template.instructions.trim()).not.toBe('');
      expect(template.categoryLabel.trim()).not.toBe('');
    }
  });

  it('keeps starters inside the server-supported limit', () => {
    for (const template of MINE_AGENT_TEMPLATES) {
      expect(template.starters.length).toBeGreaterThan(0);
      expect(template.starters.length).toBeLessThanOrEqual(Constants.MAX_CONVO_STARTERS);
      expect(template.starters.every((starter) => starter.trim().length > 0)).toBe(true);
    }
  });

  it('does not imply that a template enables any tools or model credentials', () => {
    for (const template of MINE_AGENT_TEMPLATES) {
      expect(Object.keys(template).sort()).toEqual(
        ['categoryLabel', 'description', 'id', 'instructions', 'name', 'starters', 'title'].sort(),
      );
    }
  });

  it('provides robust Research V1 instructions instead of unsupported study claims', () => {
    const research = MINE_AGENT_TEMPLATES.find((template) => template.id === 'research');
    expect(research?.instructions).toBe(MINE_RESEARCH_V1_INSTRUCTIONS);
    expect(research?.instructions).toContain('sample size');
    expect(research?.instructions).toContain('clinic-attending sample');
    expect(research?.instructions).toContain('DOI/PMID');
    expect(research?.instructions).toContain('search snippet');
    expect(research?.instructions).toContain('Do not use cross-sectional associations');
    expect(research?.instructions).toContain('Never fabricate citations');
    expect(research?.instructions).toContain('If a tool is unavailable');
    expect(research?.starters).toHaveLength(3);
    expect(research?.starters[0]).toContain('research protocol');
  });

});
