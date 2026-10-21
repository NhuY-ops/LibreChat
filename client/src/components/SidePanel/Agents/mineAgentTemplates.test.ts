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

  it('keeps Agent blueprints to inert form fields and advisory catalog metadata', () => {
    const allowed = new Set([
      'categoryLabel', 'description', 'id', 'instructions', 'name', 'starters', 'title',
      'collection', 'requiredTool', 'workflow',
    ]);
    for (const template of MINE_AGENT_TEMPLATES) {
      expect(Object.keys(template).every((key) => allowed.has(key))).toBe(true);
      expect('tools' in template).toBe(false);
      expect('provider' in template).toBe(false);
      expect('model' in template).toBe(false);
      expect('apiKey' in template).toBe(false);
      expect('capabilities' in template).toBe(false);
    }
  });

  it('ships 24 Creative Studio blueprints with explicit and honest requirements', () => {
    const creative = MINE_AGENT_TEMPLATES.filter((template) => template.collection != null);
    expect(MINE_AGENT_TEMPLATES).toHaveLength(29);
    expect(creative).toHaveLength(24);
    const counts = Object.fromEntries(['image', 'video', 'design', 'audio', 'content'].map((key) => [
      key,
      creative.filter((template) => template.collection === key).length,
    ]));
    expect(counts).toEqual({ image: 6, video: 5, design: 5, audio: 4, content: 4 });
    expect(creative.every((template) => template.workflow && template.workflow.length >= 2)).toBe(true);
    expect(creative.every((template) => template.instructions.includes('Do not fabricate generated files'))).toBe(true);
    expect(creative.every((template) => template.instructions.includes('Without it, provide') || !template.requiredTool)).toBe(true);
    expect(creative.find((template) => template.id === 'video-creator')?.requiredTool).toContain('video generation');
    expect(creative.find((template) => template.id === 'image-creator')?.requiredTool).toContain('image generation');
    expect(creative.find((template) => template.id === 'voiceover-studio')?.requiredTool).toContain('text-to-speech');
    expect(creative.find((template) => template.id === 'storyboard-director')?.requiredTool).toBeUndefined();
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
