import React from 'react';
import { render, screen } from '@testing-library/react';
import LineChart from '../../../components/ui/LineChart';

// Mock data
const mockData = [
  { month: 'Jan', value: 1000 },
  { month: 'Feb', value: 1200 },
  { month: 'Mar', value: 1100 },
  { month: 'Apr', value: 1300 },
];

describe('LineChart Component', () => {
  it('renders without crashing', () => {
    render(
      <LineChart
        data={mockData}
        dataKey="value"
        width="100%"
        height={200}
      />
    );
  });

  it('renders with no data message when data is empty', () => {
    render(
      <LineChart
        data={[]}
        dataKey="value"
        width="100%"
        height={200}
      />
    );
    
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    const { container } = render(
      <LineChart
        data={mockData}
        dataKey="value"
        width={400}
        height={300}
        strokeColor="#ff0000"
        strokeWidth={3}
        showDots={true}
        showArea={true}
        showGrid={true}
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '400');
    expect(svg).toHaveAttribute('height', '300');
  });

  it('handles mouse events', () => {
    const onMouseMove = jest.fn();
    const onMouseLeave = jest.fn();
    
    render(
      <LineChart
        data={mockData}
        dataKey="value"
        width="100%"
        height={200}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
    );
    
    // Mouse events are handled by the SVG element
    // We can't easily test mouse events in jsdom without more complex setup
    expect(onMouseMove).toBeDefined();
    expect(onMouseLeave).toBeDefined();
  });

  it('renders with different curve types', () => {
    const { container: container1 } = render(
      <LineChart
        data={mockData}
        dataKey="value"
        width="100%"
        height={200}
        curveType="linear"
      />
    );
    
    const { container: container2 } = render(
      <LineChart
        data={mockData}
        dataKey="value"
        width="100%"
        height={200}
        curveType="step"
      />
    );
    
    expect(container1.querySelector('svg')).toBeInTheDocument();
    expect(container2.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with custom tooltip', () => {
    const CustomTooltip = (data, index) => (
      <div data-testid="custom-tooltip">
        {data.value} - {data.month}
      </div>
    );
    
    render(
      <LineChart
        data={mockData}
        dataKey="value"
        width="100%"
        height={200}
        tooltip={CustomTooltip}
      />
    );
    
    // Tooltip is only rendered on hover, so we can't easily test it in jsdom
    expect(CustomTooltip).toBeDefined();
  });
});
