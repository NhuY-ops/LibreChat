import { Constants } from 'librechat-data-provider';
import { MINE_AGENT_TEMPLATES } from './mineAgentTemplates';

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
});
