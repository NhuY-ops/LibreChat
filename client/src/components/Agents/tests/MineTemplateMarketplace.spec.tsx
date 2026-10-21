import React from 'react';
import { getDefaultStore } from 'jotai';
import { EModelEndpoint } from 'librechat-data-provider';
import { activePanelAtom, DEFAULT_PANEL } from '~/Providers';
import { mineTemplateBuilderSessionAtom, mineTemplateHandoffAtom } from '~/components/SidePanel/Agents/mineTemplateHandoff';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MineTemplateMarketplace from '../MineTemplateMarketplace';

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname + location.search}</output>;
}

function renderGallery(searchQuery = '') {
  return render(
    <MemoryRouter initialEntries={['/agents/templates']}>
      <Routes>
        <Route path="/agents/templates" element={<MineTemplateMarketplace searchQuery={searchQuery} />} />
        <Route path="/c/new" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MINE Marketplace template gallery', () => {
  beforeEach(() => {
    getDefaultStore().set(activePanelAtom, DEFAULT_PANEL);
    getDefaultStore().set(mineTemplateHandoffAtom, null);
    getDefaultStore().set(mineTemplateBuilderSessionAtom, null);
  });
  it('shows Research V1 and links to the existing Agent builder draft flow', () => {
    renderGallery();
    expect(screen.getByRole('heading', { name: 'Agent Templates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Research Analyst' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure Research Analyst template' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/c/new?mineAgentTemplate=research');
    expect(getDefaultStore().get(activePanelAtom)).toBe(EModelEndpoint.agents);
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBe('research');
    expect(getDefaultStore().get(mineTemplateBuilderSessionAtom)).toBe('research');
  });

  it('allows previews without activating a tool or navigating', () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
    expect(screen.getByRole('region', { name: 'Research Analyst template details' })).toBeInTheDocument();
    expect(screen.getByText(/All Tools, provider keys and access permissions/)).toBeInTheDocument();
  });

  it('renders an expanded creative library with meaningful group filters', () => {
    renderGallery();
    expect(screen.getByText('29 blueprints')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Images 6' }));
    expect(screen.getByTestId('mine-template-card-image-creator')).toBeInTheDocument();
    expect(screen.getByTestId('mine-template-card-photo-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('mine-template-card-video-creator')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('6 matching templates');
    fireEvent.click(screen.getByRole('button', { name: 'Video 5' }));
    expect(screen.getByTestId('mine-template-card-video-creator')).toBeInTheDocument();
    expect(screen.queryByTestId('mine-template-card-image-creator')).not.toBeInTheDocument();
  });

  it('makes real-media setup requirements explicit in previews', () => {
    renderGallery('Image Creator');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('region', { name: 'AI Image Creator template details' })).toBeInTheDocument();
    expect(screen.getByText(/Actual rendered media requires|Real generated media requires/)).toBeInTheDocument();
    expect(screen.getByText(/compatible image generation tool|configured image generation tool/)).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText(/nothing is generated|does not create or publish an Agent/i)).toBeInTheDocument();
  });

  it('routes a creative template into the unsaved Agent Builder draft', () => {
    renderGallery('Video Creator');
    fireEvent.click(screen.getByRole('button', { name: 'Configure AI Video Creator template' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/c/new?mineAgentTemplate=video-creator');
    expect(getDefaultStore().get(activePanelAtom)).toBe(EModelEndpoint.agents);
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBe('video-creator');
    expect(getDefaultStore().get(mineTemplateBuilderSessionAtom)).toBe('video-creator');
  });

  it('filters templates and describes missing search matches', () => {
    renderGallery('no-such-blueprint');
    expect(screen.getByRole('status')).toHaveTextContent('0 matching templates');
    expect(screen.getByText(/No Agent templates match your search or filter/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Research Analyst' })).not.toBeInTheDocument();
  });
});
