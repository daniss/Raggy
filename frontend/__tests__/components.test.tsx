import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable } from '@/components/DataTable';
import { MetricsCard } from '@/components/MetricsCard';
import { Activity } from 'lucide-react';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('DataTable Component', () => {
  const mockData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
  ];

  const mockColumns = [
    { key: 'name' as const, title: 'Name', sortable: true },
    { key: 'email' as const, title: 'Email', sortable: true },
    { key: 'status' as const, title: 'Status', filterable: true },
  ];

  it('renders table with data', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('filters data based on search term', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'john' } });
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<DataTable data={[]} columns={mockColumns} loading={true} />);
    
    expect(screen.getByRole('table')).toHaveClass('animate-pulse');
  });

  it('shows no data message when empty', () => {
    render(<DataTable data={[]} columns={mockColumns} />);
    
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });
});

describe('MetricsCard Component', () => {
  it('renders metrics card with basic props', () => {
    render(
      <MetricsCard
        title="Test Metric"
        value="123"
        icon={Activity}
      />
    );
    
    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <MetricsCard
        title="Test Metric"
        value="123"
        icon={Activity}
        loading={true}
      />
    );
    
    const card = screen.getByRole('generic').parentElement;
    expect(card).toHaveClass('animate-pulse');
  });

  it('displays change badge when provided', () => {
    render(
      <MetricsCard
        title="Test Metric"
        value="123"
        icon={Activity}
        change={{ value: '+5%', type: 'increase' }}
      />
    );
    
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(
      <MetricsCard
        title="Test Metric"
        value="123"
        icon={Activity}
        onClick={handleClick}
      />
    );
    
    fireEvent.click(screen.getByText('Test Metric').closest('div')!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

// Integration test for dashboard components
describe('Dashboard Integration', () => {
  it('should render dashboard layout without errors', () => {
    // This is a basic smoke test to ensure components can render together
    const testData = [
      { id: 1, metric: 'Users', value: 150 },
      { id: 2, metric: 'Queries', value: 2500 },
    ];

    const columns = [
      { key: 'metric' as const, title: 'Metric' },
      { key: 'value' as const, title: 'Value' },
    ];

    render(
      <div>
        <MetricsCard title="Test KPI" value="100" icon={Activity} />
        <DataTable data={testData} columns={columns} />
      </div>
    );

    expect(screen.getByText('Test KPI')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
  });
});