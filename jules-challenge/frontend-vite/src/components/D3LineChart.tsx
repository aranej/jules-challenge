import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  timestamp: number; // Assuming epoch milliseconds
  value: number;
  category: string; // Unused in this basic chart, but part of the interface
}

interface D3LineChartProps {
  data: DataPoint[];
}

const D3LineChart: React.FC<D3LineChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null); // Ref for the container div

  useEffect(() => {
    const drawChart = () => {
      if (!data || data.length === 0 || !svgRef.current || !containerRef.current) {
        if (svgRef.current) {
          d3.select(svgRef.current).selectAll("*").remove();
        }
        return;
      }

      const containerWidth = containerRef.current.clientWidth;
      const aspectRatio = containerWidth < 600 ? 1.5 : 2; 
      const containerHeight = Math.max(200, containerWidth / aspectRatio); // Ensure a minimum height
      
      d3.select(svgRef.current).selectAll("*").remove(); 

      const margin = { top: 20, right: 30, bottom: 60, left: 50 }; // Increased bottom margin for rotated labels
      const width = containerWidth - margin.left - margin.right;
      const height = containerHeight - margin.top - margin.bottom;

      if (width <=0 || height <=0) return; 

      const svg = d3.select(svgRef.current)
        .attr('width', containerWidth)
        .attr('height', containerHeight);
        // No viewBox needed if we explicitly set width/height and redraw on resize

      const x = d3.scaleTime()
        .domain(d3.extent(data, d => new Date(d.timestamp)) as [Date, Date])
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) as number])
        .nice()
        .range([height, 0]);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // X-axis
      const xAxisGroup = g.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(Math.max(1, Math.floor(width / 100))).tickFormat(d3.timeFormat("%H:%M:%S")));
      
      xAxisGroup.selectAll("text") 
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

      xAxisGroup.append('text')
          .attr('class', 'axis-label')
          .attr('fill', '#000')
          .attr('x', width / 2)
          .attr('y', margin.bottom - 10) 
          .attr('text-anchor', 'middle')
          .text('Time');

      // Y-axis
      g.append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(y))
        .append('text')
          .attr('class', 'axis-label')
          .attr('fill', '#000')
          .attr('transform', 'rotate(-90)')
          .attr('y', -margin.left + 15)
          .attr('x', -height / 2)
          .attr('dy', '-0.5em') 
          .attr('text-anchor', 'middle')
          .text('Value');

      // Line generator
      const lineGenerator = d3.line<DataPoint>()
        .x(d => x(new Date(d.timestamp)))
        .y(d => y(d.value));

      // Draw the line
      g.append('path')
        .datum(data)
        .attr('class', 'line-path') 
        .attr('fill', 'none')
        .attr('stroke-width', 1.5)
        .attr('d', lineGenerator);

      const tooltip = d3.select(tooltipRef.current);
      
      g.selectAll('.dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(new Date(d.timestamp)))
        .attr('cy', d => y(d.value))
        .attr('r', containerWidth < 600 ? 3 : 4) 
        .attr('fill', '#3498db') 
        .on('mouseover', (event, d) => {
          tooltip
            .html(`Time: ${new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}<br/>Value: ${d.value.toFixed(2)}`)
            .style('visibility', 'visible');
        })
        .on('mousemove', (event) => {
          tooltip
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('visibility', 'hidden');
        });
    };
    
    drawChart();

    const resizeObserver = new ResizeObserver(() => {
        drawChart();
    });

    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    return () => {
        if (containerRef.current) {
            resizeObserver.unobserve(containerRef.current);
        }
    };
  }, [data]); 

  return (
    <div ref={containerRef} className="d3-line-chart-container">
      <svg ref={svgRef}></svg>
      <div ref={tooltipRef} className="d3-tooltip"></div>
    </div>
  );
};

export default D3LineChart;
