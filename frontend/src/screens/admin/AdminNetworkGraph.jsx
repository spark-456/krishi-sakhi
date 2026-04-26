/**
 * AdminNetworkGraph — D3 force-directed graph for admin eyes only
 * Shows: farmer nodes, farm nodes, location nodes, cooperative group nodes
 * Edges: farm_ownership, membership, group_location
 * Color + shape by node type, interactive tooltips, sidebar legend
 */
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAuth } from '../../hooks/useAuth';
import { Loader2, ArrowLeft, Users, Sprout, MapPin, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// Visual config by node type
const NODE_CONFIG = {
    farmer:   { color: '#22c55e', strokeColor: '#16a34a', radius: 10, shape: 'circle',   label: 'Farmer'   },
    farm:     { color: '#3b82f6', strokeColor: '#1d4ed8', radius: 8,  shape: 'rect',     label: 'Farm'     },
    group:    { color: '#f59e0b', strokeColor: '#b45309', radius: 13, shape: 'diamond',  label: 'Group'    },
    location: { color: '#8b5cf6', strokeColor: '#6d28d9', radius: 11, shape: 'triangle', label: 'Location' },
};

const EDGE_CONFIG = {
    farm_ownership: { color: '#94a3b8', dash: '0',   label: 'Owns Farm'   },
    membership:     { color: '#22c55e', dash: '0',   label: 'Group Member' },
    group_location: { color: '#8b5cf6', dash: '4,3', label: 'Located In'  },
};

const AdminNetworkGraph = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState(null);
    const [nodeFilter, setNodeFilter] = useState({ farmer: true, farm: true, group: true, location: true });

    useEffect(() => {
        if (session?.access_token) {
            fetch(`${API}/api/v1/admin/network-graph`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
                .then(r => r.json())
                .then(setGraphData)
                .finally(() => setLoading(false));
        }
    }, [session]);

    useEffect(() => {
        if (!graphData || !svgRef.current) return;

        const container = svgRef.current.parentElement;
        const W = container.clientWidth;
        const H = container.clientHeight || 560;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        svg.attr('width', W).attr('height', H);

        // Zoom + pan
        const g = svg.append('g');
        svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform)));

        const visibleTypes = Object.keys(nodeFilter).filter(k => nodeFilter[k]);
        const nodes = graphData.nodes.filter(n => visibleTypes.includes(n.type));
        const nodeIds = new Set(nodes.map(n => n.id));
        const links = graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

        // Force simulation
        const sim = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                if (d.type === 'group_location') return 80;
                if (d.type === 'membership') return 110;
                return 70;
            }).strength(0.6))
            .force('charge', d3.forceManyBody().strength(-220))
            .force('center', d3.forceCenter(W / 2, H / 2))
            .force('collision', d3.forceCollide().radius(d => (NODE_CONFIG[d.type]?.radius || 8) + 8));

        // Edges
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', d => EDGE_CONFIG[d.type]?.color || '#94a3b8')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', d => EDGE_CONFIG[d.type]?.dash || '0')
            .attr('opacity', 0.6);

        // Nodes group
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
            )
            .on('mouseenter', (event, d) => setTooltip({ x: event.clientX, y: event.clientY, node: d }))
            .on('mousemove', (event) => setTooltip(t => t ? { ...t, x: event.clientX, y: event.clientY } : t))
            .on('mouseleave', () => setTooltip(null));

        // Shape per type
        nodes.forEach(() => {}); // pre-compute
        node.each(function (d) {
            const cfg = NODE_CONFIG[d.type] || NODE_CONFIG.farmer;
            const el = d3.select(this);
            const r = cfg.radius;

            if (d.type === 'farmer' || d.type === 'group') {
                el.append('circle')
                    .attr('r', r)
                    .attr('fill', cfg.color)
                    .attr('stroke', cfg.strokeColor)
                    .attr('stroke-width', 2)
                    .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))');
            } else if (d.type === 'farm') {
                el.append('rect')
                    .attr('x', -r).attr('y', -r)
                    .attr('width', r * 2).attr('height', r * 2)
                    .attr('rx', 3)
                    .attr('fill', cfg.color)
                    .attr('stroke', cfg.strokeColor)
                    .attr('stroke-width', 2)
                    .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))');
            } else if (d.type === 'location') {
                const size = r * 1.4;
                el.append('polygon')
                    .attr('points', `0,${-size} ${size},${size} ${-size},${size}`)
                    .attr('fill', cfg.color)
                    .attr('stroke', cfg.strokeColor)
                    .attr('stroke-width', 2)
                    .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))');
            }

            // Label
            el.append('text')
                .text(d.label?.length > 12 ? d.label.slice(0, 11) + '…' : d.label)
                .attr('y', r + 12)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('font-weight', '600')
                .attr('fill', '#475569')
                .attr('pointer-events', 'none');
        });

        // Tick
        sim.on('tick', () => {
            link
                .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        return () => sim.stop();
    }, [graphData, nodeFilter]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-900 font-sans">
            {/* Header */}
            <header className="bg-slate-800 px-5 pt-10 pb-4 text-white border-b border-slate-700">
                <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-slate-400 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Dashboard
                </button>
                <h1 className="text-xl font-bold text-white">Cooperative Network Graph</h1>
                <p className="text-xs text-slate-400 mt-0.5">Drag to move • Scroll to zoom • Hover nodes for details</p>
            </header>

            {/* Filter toggles */}
            <div className="flex gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700 overflow-x-auto no-scrollbar">
                {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
                    <button
                        key={type}
                        onClick={() => setNodeFilter(f => ({ ...f, [type]: !f[type] }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex-shrink-0 ${
                            nodeFilter[type] ? 'border-transparent text-white' : 'bg-slate-700 border-slate-600 text-slate-400'
                        }`}
                        style={nodeFilter[type] ? { backgroundColor: cfg.color, borderColor: cfg.strokeColor } : {}}
                    >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        {cfg.label}
                    </button>
                ))}
            </div>

            {/* Graph area */}
            <div className="flex-1 relative" style={{ minHeight: '480px' }}>
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">Loading network data…</p>
                        </div>
                    </div>
                ) : (
                    <svg ref={svgRef} className="w-full" style={{ background: '#0f172a' }} />
                )}

                {/* Tooltip */}
                {tooltip && (
                    <div
                        className="fixed z-50 bg-slate-800 border border-slate-600 text-white text-xs rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none max-w-[200px]"
                        style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
                    >
                        <p className="font-bold capitalize mb-1" style={{ color: NODE_CONFIG[tooltip.node.type]?.color }}>
                            {tooltip.node.type}
                        </p>
                        <p className="text-white font-medium">{tooltip.node.label}</p>
                        {tooltip.node.district && <p className="text-slate-400 mt-0.5">{tooltip.node.district}</p>}
                        {tooltip.node.soil_type && <p className="text-slate-400">Soil: {tooltip.node.soil_type}</p>}
                        {tooltip.node.area_acres && <p className="text-slate-400">{tooltip.node.area_acres} acres</p>}
                        {tooltip.node.member_count != null && <p className="text-slate-400">{tooltip.node.member_count} members</p>}
                    </div>
                )}
            </div>

            {/* Legend sidebar bottom strip */}
            <div className="bg-slate-800 border-t border-slate-700 px-4 py-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Legend</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <div className="flex items-center gap-4 flex-wrap">
                        {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
                            <div key={type} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                                <span className="text-[11px] text-slate-300">{cfg.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap mt-1">
                        {Object.entries(EDGE_CONFIG).map(([type, cfg]) => (
                            <div key={type} className="flex items-center gap-1.5">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke={cfg.color} strokeWidth="2" strokeDasharray={cfg.dash} /></svg>
                                <span className="text-[11px] text-slate-400">{cfg.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminNetworkGraph;
