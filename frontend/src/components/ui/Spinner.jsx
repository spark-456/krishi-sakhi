/**
 * Spinner — Reusable loading indicator
 * ─────────────────────────────────────
 * Uses Tailwind animation. Matches the green primary design system.
 *
 * Props:
 *   size  — 'sm' | 'md' | 'lg' (default: 'md')
 *   label — accessible screen reader text (default: 'Loading...')
 */
import React from 'react'

const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
}

const Spinner = ({ size = 'md', label = 'Loading...' }) => {
    return (
        <div className="flex items-center justify-center" role="status" aria-label={label}>
            <div
                className={`${sizeMap[size]} border-slate-200 border-t-primary rounded-full animate-spin`}
            />
            <span className="sr-only">{label}</span>
        </div>
    )
}

export default Spinner
