import { cn } from '@/lib/utils'

/** Minimal dependency-free SVG sparkline. */
function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  strokeClass = 'stroke-primary',
  fill = true,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
  strokeClass?: string
  fill?: boolean
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pts = data.map((d, i) => {
    const x = i * stepX
    const y = height - ((d - min) / range) * (height - 2) - 1
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} ${width},${height} 0,${height}`
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && <polygon points={area} className="fill-primary/10" />}
      <polyline
        points={line}
        fill="none"
        className={strokeClass}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export { Sparkline }
