import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { makeDataset } from '../../test/fixtures';
import { makeLegislation } from '../../test/legislationFixture';
import { Legislation } from './Legislation';

afterEach(() => { window.location.hash = ''; });

const renderPage = () => render(<Legislation load={() => Promise.resolve(makeLegislation())} today="2026-10-15" />);

describe('Legislation page', () => {
  it('summarises acts in force, pending proposals and upcoming deadlines', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'EU road safety legislation' })).toBeInTheDocument();
    expect(screen.getByText('Acts in force').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Commission proposals pending').parentElement).toHaveTextContent('1 more with unclear status');
    const deadlines = screen.getByRole('region', { name: 'Upcoming transposition deadlines' });
    expect(within(deadlines).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(within(deadlines).getAllByRole('row')[1]).toHaveTextContent('26 Nov 2027');
    expect(screen.getByRole('note')).toHaveTextContent('does not assess whether a Member State has transposed');
  });

  it('lists pending proposals with the act they would amend, and keeps unclear ones apart', async () => {
    renderPage();
    const section = await screen.findByRole('region', { name: 'Proposals in the legislative process' });
    const row = within(section).getByRole('rowheader', { name: /COM\(2023\) 126/ }).closest('tr')!;
    expect(row).toHaveTextContent('Would amend: Directive (EU) 2015/413');
    expect(within(section).getByText('1 older proposal with unclear status')).toBeInTheDocument();
    expect(within(section).getByText(/may have ended/)).toBeInTheDocument();
  });

  it('shows acts in force by default and filters by status and search', async () => {
    const user = userEvent.setup();
    renderPage();
    const register = await screen.findByRole('region', { name: 'Register of legal acts' });
    expect(within(register).getAllByRole('article')).toHaveLength(2);
    expect(within(register).getByText('2 of 4 acts, newest first.')).toBeInTheDocument();
    const cbe = within(register).getByRole('article', { name: /Directive \(EU\) 2015\/413/ });
    expect(cbe).toHaveTextContent('In force');
    expect(cbe).toHaveTextContent('Amendment proposed: COM(2023) 126');
    expect(within(cbe).getByRole('link', { name: /COM\(2014\) 476/ })).toHaveAttribute('href', expect.stringContaining('CELEX:52014PC0476'));

    await user.selectOptions(within(register).getByLabelText('Status'), 'all');
    expect(within(register).getAllByRole('article')).toHaveLength(4);
    const old = within(register).getByRole('article', { name: /Directive 2006\/126\/EC/ });
    expect(old).toHaveTextContent('No longer in force');
    expect(old).toHaveTextContent('Curated addition');
    expect(within(old).getByText('Repealed by').nextSibling).toHaveTextContent('Directive (EU) 2025/2205');

    await user.type(within(register).getByLabelText('Search'), 'enforcement');
    expect(within(register).getAllByRole('article')).toHaveLength(1);
    expect(within(register).getByRole('article')).toHaveTextContent('Status not recorded');

    await user.clear(within(register).getByLabelText('Search'));
    await user.type(within(register).getByLabelText('Search'), 'no such act');
    expect(within(register).getByText('No acts match these filters.')).toBeInTheDocument();
  });

  it('marks transposition deadlines as passed or upcoming', async () => {
    renderPage();
    const register = await screen.findByRole('region', { name: 'Register of legal acts' });
    const recent = within(register).getByRole('article', { name: /2025\/2205/ });
    expect(within(recent).getAllByText('upcoming')).toHaveLength(3);
    const cbe = within(register).getByRole('article', { name: /2015\/413/ });
    expect(within(cbe).getByText('passed')).toBeInTheDocument();
  });

  it('shows an error with a link to EUR-Lex when the register cannot be loaded', async () => {
    render(<Legislation load={() => Promise.reject(new Error('Could not load legislation.json (HTTP 404).'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
    expect(screen.getByRole('link', { name: 'EUR-Lex' })).toHaveAttribute('href', 'https://eur-lex.europa.eu/');
  });

  it('is reachable from the main navigation and works even if the statistics fail', async () => {
    window.location.hash = '#/legislation';
    await new Promise((r) => setTimeout(r, 0));
    render(<App load={() => Promise.reject(new Error('stats down'))} loadRegister={() => Promise.resolve(makeLegislation())} />);
    expect(await screen.findByRole('heading', { name: 'EU road safety legislation' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Legislation' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the statistics pages independent of the register', async () => {
    window.location.hash = '#/';
    await new Promise((r) => setTimeout(r, 0));
    const loadRegister = vi.fn(() => Promise.resolve(makeLegislation()));
    render(<App load={() => Promise.resolve(makeDataset())} loadRegister={loadRegister} />);
    expect(await screen.findAllByRole('figure')).not.toHaveLength(0);
    expect(loadRegister).not.toHaveBeenCalled();
  });
});
