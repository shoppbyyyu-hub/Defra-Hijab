import React, { useState } from 'react';
import { formatRp, formatRpShort } from './adminUtils.ts';

// -----------------------------------------------------------------------------
// 1. AREA CHART: TREN PENJUALAN & Keuntungan KOTOR (SVG-BASED WITH GRADIENTS)
// -----------------------------------------------------------------------------

interface SalesTrendChartProps {
  data: Array<{
    date: string;
    omzet: number;
    grossProfit: number;
    ordersCount?: number;
  }>;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [viewInterval, setViewInterval] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');

  // If no data
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] md:h-[240px] flex flex-col items-center justify-center border border-dashed border-[#E9E5DF] rounded-[16px] text-[#716B64] p-4 md:p-6 text-center">
        <p className="text-sm font-medium text-[#24221F]">Belum ada data transaksi</p>
        <p className="text-xs text-[#716B64] mt-1">
          Transaksi yang terverifikasi akan otomatis membentuk grafik tren penjualan di sini.
        </p>
      </div>
    );
  }

  // If exactly 1 point
  if (data.length === 1) {
    const single = data[0];
    return (
      <div className="h-[200px] md:h-[240px] flex flex-col items-center justify-center bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] p-4 md:p-6 text-center relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#E08F79]/15 rounded-full blur-2xl pointer-events-none" />
        <span className="px-3 py-1 bg-white border border-[#E9E5DF] rounded-full text-[11px] font-semibold text-[#87533F] mb-3 shadow-xs">
          1 transaksi pada periode ini
        </span>
        <p className="text-xs text-[#716B64] mb-1 font-sans">{single.date}</p>
        <p className="text-2xl font-bold text-[#24221F] font-sans tabular-nums">{formatRp(single.omzet)}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-[#26786C]/10 text-[#26786C] rounded-full text-xs font-semibold">
          <span>Keuntungan kotor: {formatRp(single.grossProfit)}</span>
        </div>
      </div>
    );
  }

  // Multi-point SVG chart layout
  const width = 640;
  const height = 220;
  const paddingLeft = 52;
  const paddingRight = 20;
  const paddingTop = 24;
  const paddingBottom = 32;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Calculate scales (support positive & negative gross profit)
  const allValues = data.flatMap((d) => [d.omzet, d.grossProfit]);
  const rawMax = Math.max(100_000, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const maxVal = rawMax * 1.15; // 15% headroom
  const minVal = rawMin < 0 ? rawMin * 1.15 : 0;
  const valRange = maxVal - minVal || 1;

  const getY = (val: number) => {
    const ratio = (val - minVal) / valRange;
    return paddingTop + chartH - ratio * chartH;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + (index / (data.length - 1)) * chartW;
  };

  const baselineY = getY(0);

  // Smooth natural cubic bezier path generator
  const generateSmoothPath = (valKey: 'omzet' | 'grossProfit') => {
    if (data.length === 2) {
      const p0 = `${getX(0)},${getY(data[0][valKey])}`;
      const p1 = `${getX(1)},${getY(data[1][valKey])}`;
      return `M ${p0} L ${p1}`;
    }

    let path = `M ${getX(0)},${getY(data[0][valKey])}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x0 = getX(i);
      const y0 = getY(data[i][valKey]);
      const x1 = getX(i + 1);
      const y1 = getY(data[i + 1][valKey]);

      const prevY = i > 0 ? getY(data[i - 1][valKey]) : y0;
      const nextY = i < data.length - 2 ? getY(data[i + 2][valKey]) : y1;

      const dx = (x1 - x0) / 3;
      const cp1x = x0 + dx;
      const cp1y = y0 + (y1 - prevY) * 0.16;
      const cp2x = x1 - dx;
      const cp2y = y1 - (nextY - y0) * 0.16;

      path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
    }
    return path;
  };

  const omzetLinePath = generateSmoothPath('omzet');
  const grossLinePath = generateSmoothPath('grossProfit');

  const lastX = getX(data.length - 1);
  const firstX = getX(0);

  const omzetAreaPath = `${omzetLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
  const grossAreaPath = `${grossLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

  // Grid lines
  const yTicks = [
    maxVal * 0.9,
    maxVal * 0.45,
    minVal < 0 ? minVal * 0.8 : 0
  ];

  return (
    <div className="relative w-full motion-chart-enter">
      {/* Chart Top Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-4 text-xs font-medium">
          {/* Omzet Legend with Rose Gold -> Bronze Gradient Pill */}
          <span className="flex items-center gap-2">
            <span className="text-[#87533F] font-semibold">Omzet Penjualan</span>
          </span>

          {/* Keuntungan Kotor Legend with Teal Terang -> Teal Gelap Gradient Pill */}
          <span className="flex items-center gap-2">
            <span className="text-[#0D7468] font-semibold">Keuntungan Kotor FIFO</span>
          </span>
        </div>

        {/* Time Interval Selector */}
        <div className="inline-flex items-center bg-[#F6F5F2] p-0.5 rounded-[10px] text-[11px] font-medium border border-[#E9E5DF]">
          <button
            type="button"
            onClick={() => setViewInterval('DAILY')}
            className={`px-3 py-1 rounded-[7px] transition-colors ${viewInterval === 'DAILY'
              ? 'bg-white text-[#24221F] shadow-xs font-semibold'
              : 'text-[#716B64] hover:text-[#24221F]'
              }`}
          >
            Harian
          </button>
          <button
            type="button"
            onClick={() => setViewInterval('WEEKLY')}
            className={`px-3 py-1 rounded-[7px] transition-colors ${viewInterval === 'WEEKLY'
              ? 'bg-white text-[#24221F] shadow-xs font-semibold'
              : 'text-[#716B64] hover:text-[#24221F]'
              }`}
          >
            Mingguan
          </button>
          <button
            type="button"
            onClick={() => setViewInterval('MONTHLY')}
            className={`px-3 py-1 rounded-[7px] transition-colors ${viewInterval === 'MONTHLY'
              ? 'bg-white text-[#24221F] shadow-xs font-semibold'
              : 'text-[#716B64] hover:text-[#24221F]'
              }`}
          >
            Bulanan
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[200px] md:h-[225px] overflow-visible select-none"
        >
          <defs>
            {/* Omzet Line Colored Gradient: Rose Gold -> Bronze */}
            <linearGradient id="omzetStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F5A394" />
              <stop offset="50%" stopColor="#DF8A73" />
              <stop offset="100%" stopColor="#9C5338" />
            </linearGradient>

            {/* Omzet Area Fill Gradient: Fades from 45% to 3% opacity */}
            <linearGradient id="omzetAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E08F79" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#9C5338" stopOpacity="0.03" />
            </linearGradient>

            {/* Keuntungan Kotor Line Colored Gradient: Teal Terang -> Teal Gelap */}
            <linearGradient id="grossStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#0B5E55" />
            </linearGradient>

            {/* Keuntungan Kotor Area Fill Gradient: Fades from 45% to 3% opacity */}
            <linearGradient id="grossAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0B5E55" stopOpacity="0.03" />
            </linearGradient>

            {/* Subtle glow filter for lines */}
            <filter id="chartLineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* Horizontal Gridlines & Labels */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            const isZero = Math.abs(val) < 1;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={isZero ? '#24221F' : '#E9E5DF'}
                  strokeWidth={isZero ? '1.2' : '1'}
                  strokeDasharray={isZero ? undefined : '3 3'}
                  strokeOpacity={isZero ? '0.35' : '1'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#716B64"
                  className="font-sans tabular-nums font-medium"
                >
                  {formatRpShort(val)}
                </text>
              </g>
            );
          })}

          {/* Area Fills with Clear Gradients (45% -> 3%) */}
          <path d={omzetAreaPath} fill="url(#omzetAreaGrad)" />
          <path d={grossAreaPath} fill="url(#grossAreaGrad)" />

          {/* Colored Gradient Stroke Lines (Rose Gold -> Bronze & Teal Terang -> Teal Gelap) */}
          <path
            d={omzetLinePath}
            fill="none"
            stroke="url(#omzetStrokeGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#chartLineGlow)"
          />
          <path
            d={grossLinePath}
            fill="none"
            stroke="url(#grossStrokeGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#chartLineGlow)"
          />

          {/* Baseline Zero Indicator */}
          <line
            x1={paddingLeft}
            y1={baselineY}
            x2={width - paddingRight}
            y2={baselineY}
            stroke="#24221F"
            strokeOpacity="0.2"
            strokeWidth="1.2"
          />

          {/* Interactive Data Nodes */}
          {data.map((d, i) => {
            const x = getX(i);
            const yOmzet = getY(d.omzet);
            const yGross = getY(d.grossProfit);
            const isHovered = hoverIndex === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              >
                {/* Vertical guideline on hover */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={height - paddingBottom}
                    stroke="#24221F"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    strokeOpacity="0.45"
                  />
                )}

                {/* Point Omzet */}
                <circle
                  cx={x}
                  cy={yOmzet}
                  r={isHovered ? 6 : 4}
                  fill="#FFFFFF"
                  stroke="#DF8A73"
                  strokeWidth="2.5"
                  className="transition-all duration-150"
                />

                {/* Point Gross Profit */}
                <circle
                  cx={x}
                  cy={yGross}
                  r={isHovered ? 6 : 4}
                  fill="#FFFFFF"
                  stroke="#14B8A6"
                  strokeWidth="2.5"
                  className="transition-all duration-150"
                />

                {/* Date Label on X Axis */}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? '#24221F' : '#716B64'}
                  fontWeight={isHovered ? '600' : '500'}
                  className="font-sans"
                >
                  {d.date.length > 5 ? d.date.slice(5) : d.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div
            className="absolute top-6 pointer-events-none z-30 bg-[#1C1A18] text-white text-xs rounded-[12px] p-3 shadow-2xl border border-white/15 -translate-x-1/2 transition-all duration-100 min-w-[170px]"
            style={{
              left: `${Math.max(90, Math.min(width - 90, getX(hoverIndex)))}px`
            }}
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
              <span className="text-[11px] text-[#F3D8A2] font-semibold font-sans">
                {data[hoverIndex].date}
              </span>
              {data[hoverIndex].ordersCount !== undefined && (
                <span className="text-[10px] text-white/60">
                  {data[hoverIndex].ordersCount} pesanan
                </span>
              )}
            </div>

            <div className="space-y-1.5 font-sans text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#F5A394] font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#DF8A73]" />
                  Omzet:
                </span>
                <span className="font-bold text-white tabular-nums">
                  {formatRp(data[hoverIndex].omzet)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#2DD4BF] font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                  Keuntungan Kotor:
                </span>
                <span className="font-bold text-[#2DD4BF] tabular-nums">
                  {formatRp(data[hoverIndex].grossProfit)}
                </span>
              </div>
              {data[hoverIndex].omzet > 0 && (
                <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                  <span>Margin:</span>
                  <span className="text-white font-semibold">
                    {((data[hoverIndex].grossProfit / data[hoverIndex].omzet) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. DONUT CHART: KOMPOSISI STATUS PESANAN (GRADIENT SETIAP SEGMEN, DEPTH & THICK RING)
// -----------------------------------------------------------------------------

interface OrderCompositionDonutProps {
  ordersCount: number;
  segments: Array<{
    key: string;
    label: string;
    count: number;
    color: string;
  }>;
}

export const OrderCompositionDonut: React.FC<OrderCompositionDonutProps> = ({
  ordersCount,
  segments
}) => {
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const total = segments.reduce((sum, s) => sum + s.count, 0) || ordersCount;

  // Geometry: 180px diameter, thick ring (outer 78, inner 50 -> 28px thickness)
  const size = 180;
  const center = size / 2;
  const outerR = 78;
  const innerR = 50;

  // Gradient ID and Tailwind class mappings for the 4 status types
  const getGradientId = (key: string) => {
    switch (key) {
      case 'VERIFIED':
        return 'donutGrad-teal';
      case 'WAITING_VERIFICATION':
        return 'donutGrad-champagne';
      case 'PROCESSING':
        return 'donutGrad-blue';
      case 'RETURNS':
        return 'donutGrad-rosebronze';
      default:
        return 'donutGrad-teal';
    }
  };

  const getGradientClass = (key: string) => {
    switch (key) {
      case 'VERIFIED':
        return 'from-[#2DD4BF] to-[#0D9488]';
      case 'WAITING_VERIFICATION':
        return 'from-[#FDE68A] to-[#D97706]';
      case 'PROCESSING':
        return 'from-[#60A5FA] to-[#2563EB]';
      case 'RETURNS':
        return 'from-[#FDA4AF] to-[#C2410C]';
      default:
        return 'from-[#2DD4BF] to-[#0D9488]';
    }
  };

  const activeSegments = segments.filter((s) => s.count > 0);
  const gapDeg = activeSegments.length > 1 ? 3.5 : 0;

  // Helper to generate SVG Arc Path
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  };

  const describeDonutArc = (
    cx: number,
    cy: number,
    rIn: number,
    rOut: number,
    startAngle: number,
    endAngle: number
  ) => {
    const pOutStart = polarToCartesian(cx, cy, rOut, startAngle);
    const pOutEnd = polarToCartesian(cx, cy, rOut, endAngle);
    const pInEnd = polarToCartesian(cx, cy, rIn, endAngle);
    const pInStart = polarToCartesian(cx, cy, rIn, startAngle);

    const arcAngle = endAngle - startAngle;
    const largeArcFlag = arcAngle > 180 ? 1 : 0;

    return [
      `M ${pOutStart.x.toFixed(2)} ${pOutStart.y.toFixed(2)}`,
      `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${pOutEnd.x.toFixed(2)} ${pOutEnd.y.toFixed(2)}`,
      `L ${pInEnd.x.toFixed(2)} ${pInEnd.y.toFixed(2)}`,
      `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${pInStart.x.toFixed(2)} ${pInStart.y.toFixed(2)}`,
      'Z'
    ].join(' ');
  };

  let accumulatedAngle = 0;

  return (
    <div className="flex flex-col items-center justify-between h-full space-y-4 motion-chart-enter">
      {/* Donut Graphic Canvas */}
      <div className="relative w-[180px] h-[180px] flex items-center justify-center shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="select-none overflow-visible"
        >
          <defs>
            {/* 1. Teal Gradient (Selesai / Terverifikasi) */}
            <linearGradient id="donutGrad-teal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>

            {/* 2. Champagne Gradient (Menunggu Review Bukti) */}
            <linearGradient id="donutGrad-champagne" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            {/* 3. Blue Gradient (Siap Dikemas / Dikirim) */}
            <linearGradient id="donutGrad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>

            {/* 4. Rose Bronze Gradient (Retur / Komplain) */}
            <linearGradient id="donutGrad-rosebronze" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="100%" stopColor="#C2410C" />
            </linearGradient>

            {/* Reference diagonal hatch pattern for tactile texture */}
            <pattern id="donutHatchPattern" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" />
            </pattern>

            {/* Soft shadow filter for depth */}
            <filter id="donutDepthShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.09" />
            </filter>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx={center}
            cy={center}
            r={(outerR + innerR) / 2}
            fill="none"
            stroke="#F6F5F2"
            strokeWidth={outerR - innerR}
          />

          {total === 0 ? (
            /* Empty State */
            <circle
              cx={center}
              cy={center}
              r={(outerR + innerR) / 2}
              fill="none"
              stroke="#E9E5DF"
              strokeWidth={outerR - innerR}
            />
          ) : activeSegments.length === 1 ? (
            /* Single Status: Continuous full ring with that segment's gradient */
            <g>
              <circle
                cx={center}
                cy={center}
                r={(outerR + innerR) / 2}
                fill="none"
                stroke={`url(#${getGradientId(activeSegments[0].key)})`}
                strokeWidth={outerR - innerR}
                filter="url(#donutDepthShadow)"
              />
            </g>
          ) : (
            /* Multi-Segment Arcs with Gradients & Separators */
            <g filter="url(#donutDepthShadow)">
              {segments.map((seg) => {
                if (seg.count <= 0) return null;

                const segFraction = seg.count / total;
                const segSpanDeg = segFraction * 360;

                const startAngle = accumulatedAngle + gapDeg / 2;
                const endAngle = accumulatedAngle + segSpanDeg - gapDeg / 2;
                accumulatedAngle += segSpanDeg;

                const arcD = describeDonutArc(center, center, innerR, outerR, startAngle, endAngle);
                const isHovered = hoverKey === seg.key;
                const isWaitingReview = seg.key === 'WAITING_VERIFICATION';

                return (
                  <g
                    key={seg.key}
                    onMouseEnter={() => setHoverKey(seg.key)}
                    onMouseLeave={() => setHoverKey(null)}
                    className="cursor-pointer transition-all duration-200"
                  >
                    {/* Primary Gradient Segment */}
                    <path
                      d={arcD}
                      fill={`url(#${getGradientId(seg.key)})`}
                      className={`transition-all duration-200 ${isHovered ? 'filter drop-shadow(0 0 4px rgba(0,0,0,0.2)) opacity-100' : 'opacity-95'
                        }`}
                    />

                    {/* Reference texture hatching overlay on Champagne / Waiting Verification segment */}
                    {isWaitingReview && (
                      <path
                        d={arcD}
                        fill="url(#donutHatchPattern)"
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Concentric inner and outer border rings for tactile crispness */}
          <circle
            cx={center}
            cy={center}
            r={outerR}
            fill="none"
            stroke="rgba(36,34,31,0.06)"
            strokeWidth="1"
          />
          <circle
            cx={center}
            cy={center}
            r={innerR}
            fill="none"
            stroke="rgba(36,34,31,0.06)"
            strokeWidth="1"
          />
        </svg>

        {/* Center Summary Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[28px] font-bold text-[#24221F] tracking-tight tabular-nums font-sans leading-none">
            {total}
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#716B64] mt-1">
            Total Pesanan
          </span>
        </div>
      </div>

      {/* Legend with Counts, Percentages & Segment-matched Gradients */}
      <div className="w-full space-y-2 text-xs pt-1 border-t border-[#E9E5DF]">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          const isHovered = hoverKey === s.key;

          return (
            <div
              key={s.key}
              onMouseEnter={() => setHoverKey(s.key)}
              onMouseLeave={() => setHoverKey(null)}
              className={`flex items-center justify-between p-1 rounded-[8px] transition-colors ${isHovered ? 'bg-[#F6F5F2]' : ''
                }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-3 h-3 rounded-full bg-gradient-to-br ${getGradientClass(
                    s.key
                  )} shrink-0 shadow-xs border border-black/5`}
                />
                <span className={`truncate text-xs ${isHovered ? 'font-semibold text-[#24221F]' : 'text-[#716B64]'}`}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-2 font-sans tabular-nums shrink-0">
                <span className="font-semibold text-[#24221F]">{s.count}</span>
                <span className="text-[10px] text-[#716B64] w-8 text-right font-medium">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
