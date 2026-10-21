import React from 'react';
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
  it('shows Research V1 and links to the existing Agent builder draft flow', () => {
    renderGallery();
    expect(screen.getByRole('heading', { name: 'Agent Templates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Research Analyst' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure Research Analyst template' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/c/new?mineAgentTemplate=research');
  });

  it('allows previews without activating a tool or navigating', () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
    expect(screen.getByRole('region', { name: 'Research Analyst template details' })).toBeInTheDocument();
    expect(screen.getByText(/Tools require explicit permission/)).toBeInTheDocument();
  });

  it('filters templates and describes missing search matches', () => {
    renderGallery('no-such-blueprint');
    expect(screen.getByRole('status')).toHaveTextContent('No Agent templates match your search');
    expect(screen.queryByRole('heading', { name: 'Research Analyst' })).not.toBeInTheDocument();
  });
});
