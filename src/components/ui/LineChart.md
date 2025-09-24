# Custom LineChart Component

A reusable, customizable line chart component built with SVG for optimal performance and flexibility.

## Features

- **SVG-based rendering** for crisp graphics at any resolution
- **Responsive design** that adapts to container size
- **Multiple curve types** (linear, monotone, step, etc.)
- **Area fill support** with customizable gradients
- **Interactive tooltips** and hover effects (optional)
- **Smart dot behavior** - dots only appear on hover by default
- **Grid lines** and axis labels
- **Smooth animations** with customizable duration
- **TypeScript support** with full type definitions

## Basic Usage

```tsx
import LineChart from '../ui/LineChart';

const data = [
  { month: 'Jan', value: 1000 },
  { month: 'Feb', value: 1200 },
  { month: 'Mar', value: 1100 },
  // ... more data points
];

<LineChart
  data={data}
  dataKey="value"
  width="100%"
  height={200}
  strokeColor="var(--color-accent)"
  onMouseMove={(data, index) => console.log('Hovered:', data)}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `DataPoint[]` | `[]` | Array of data objects |
| `dataKey` | `string` | `'value'` | Key to extract values from data objects |
| `width` | `number \| string` | `'100%'` | Chart width |
| `height` | `number \| string` | `200` | Chart height |
| `margin` | `object` | `{top: 20, right: 20, bottom: 20, left: 20}` | Chart margins |
| `strokeColor` | `string` | `'var(--color-accent)'` | Line stroke color |
| `strokeWidth` | `number` | `2` | Line stroke width |
| `fillColor` | `string` | - | Area fill color (when showArea is true) |
| `showDots` | `boolean` | `false` | Show data point dots (always visible) |
| `dotColor` | `string` | - | Dot color (defaults to strokeColor) |
| `dotRadius` | `number` | `2` | Dot radius |
| `showArea` | `boolean` | `false` | Show area fill under the line |
| `areaOpacity` | `number` | `0.3` | Area fill opacity |
| `onMouseMove` | `function` | - | Mouse move handler: `(data, index) => void` |
| `onMouseLeave` | `function` | - | Mouse leave handler |
| `className` | `string` | `''` | Additional CSS classes |
| `style` | `object` | `{}` | Additional inline styles |
| `gradientId` | `string` | `'lineChartGradient'` | Unique ID for gradients |
| `showGrid` | `boolean` | `false` | Show grid lines |
| `gridColor` | `string` | `'var(--color-border)'` | Grid line color |
| `showXAxis` | `boolean` | `false` | Show X-axis labels |
| `showYAxis` | `boolean` | `false` | Show Y-axis labels |
| `xAxisLabel` | `string` | - | X-axis label |
| `yAxisLabel` | `string` | - | Y-axis label |
| `formatXAxis` | `function` | - | X-axis value formatter |
| `formatYAxis` | `function` | - | Y-axis value formatter |
| `tooltip` | `function` | - | Custom tooltip renderer: `(data, index) => ReactNode` |
| `showTooltip` | `boolean` | `false` | Show tooltip on hover |
| `animationDuration` | `number` | `300` | Animation duration in ms |
| `curveType` | `string` | `'monotone'` | Curve type: 'linear', 'monotone', 'step', etc. |

## Examples

### Basic Line Chart
```tsx
<LineChart
  data={data}
  dataKey="value"
  width="100%"
  height={200}
  strokeColor="#3b82f6"
  strokeWidth={2}
/>
```

### Area Chart with Tooltip
```tsx
<LineChart
  data={data}
  dataKey="value"
  width="100%"
  height={200}
  strokeColor="#10b981"
  showArea={true}
  areaOpacity={0.2}
  tooltip={(data, index) => (
    <div>
      <div className="font-semibold">{formatCurrency(data.value)}</div>
      <div className="text-xs">{data.month}</div>
    </div>
  )}
  onMouseMove={(data, index) => setHoveredData(data)}
/>
```

### Chart with Grid and Custom Styling
```tsx
<LineChart
  data={data}
  dataKey="value"
  width="100%"
  height={300}
  strokeColor="var(--color-accent)"
  strokeWidth={3}
  showGrid={true}
  gridColor="var(--color-border)"
  showDots={true}
  dotColor="var(--color-accent)"
  dotRadius={5}
  curveType="monotone"
  className="my-custom-chart"
/>
```

### Step Chart
```tsx
<LineChart
  data={data}
  dataKey="value"
  width="100%"
  height={200}
  strokeColor="#ef4444"
  strokeWidth={2}
  curveType="step"
  showDots={true}
/>
```

## Data Format

The component expects data in the following format:

```tsx
interface DataPoint {
  [key: string]: any;
  value: number; // The value to be plotted
}
```

Example:
```tsx
const data = [
  { month: 'Jan', value: 1000, category: 'A' },
  { month: 'Feb', value: 1200, category: 'A' },
  { month: 'Mar', value: 1100, category: 'B' },
];
```

## Styling

The component uses CSS custom properties for theming:

- `--color-accent`: Default accent color
- `--color-border`: Border and grid color
- `--color-bg`: Background color
- `--color-fg`: Text color
- `--color-muted`: Muted text color

## Performance

- Uses SVG for crisp rendering at any resolution
- Efficient mouse event handling
- Minimal re-renders with proper memoization
- Responsive design with ResizeObserver

## Browser Support

- Modern browsers with SVG support
- ES6+ features (use modern bundler)
- CSS custom properties support
