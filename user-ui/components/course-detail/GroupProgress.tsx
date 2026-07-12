'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useBranding } from '../BrandingProvider';

interface GroupProgressProps {
  current: number;
  max: number;
  label?: string;
  variant?: 'default' | 'compact' | 'detailed' | 'card';
  showMilestones?: boolean;
  showPercentage?: boolean;
  animate?: boolean;
  className?: string;
}

export function GroupProgress({
  current,
  max,
  label = 'المجموعة الحالية',
  variant = 'default',
  showMilestones = true,
  showPercentage = true,
  animate = true,
  className = '',
}: GroupProgressProps) {
  const { primaryColor } = useBranding();
  const [displayProgress, setDisplayProgress] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animateRef = useRef<{ startTime: number } | null>(null);

  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isFull = pct >= 100;
  const isAlmostFull = pct >= 80;
  const remaining = max - current;

  const colors = {
    bg: isFull ? 'rgba(220,38,38,0.08)' : isAlmostFull ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
    border: isFull ? 'rgba(220,38,38,0.2)' : isAlmostFull ? 'rgba(217,119,6,0.2)' : 'rgba(22,163,74,0.2)',
    text: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
    glow: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
  };

  const gradient = isFull
    ? 'linear-gradient(90deg, #dc2626, #ef4444)'
    : isAlmostFull
    ? 'linear-gradient(90deg, #d97706, #f59e0b)'
    : 'linear-gradient(90deg, #16a34a, #22c55e)';

  // Create animate function outside useEffect
  const animateFn = useCallback((currentTime: number) => {
    const startTime = animateRef.current?.startTime || performance.now();
    animateRef.current = animateRef.current || { startTime };
    const elapsed = currentTime - animateRef.current.startTime;
    const duration = 1000;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    setDisplayProgress(pct * eased);

    if (progress < 1) {
      requestAnimationFrame(animateFn);
    }
  }, [pct]);

  // Animate progress on mount
  useEffect(() => {
    if (!animate) {
      setDisplayProgress(pct);
      return;
    }

    animateRef.current = { startTime: performance.now() };
    requestAnimationFrame(animateFn);
  }, [pct, animate, animateFn]);

  // Intersection observer for scroll-triggered animation
  useEffect(() => {
    if (!animate) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && displayProgress === 0) {
          setDisplayProgress(0); // Trigger re-animation
        }
      },
      { threshold: 0.5, rootMargin: '0px 0px -100px 0px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [animate, displayProgress]);

  const statusIcon = isFull ? '🏆' : isAlmostFull ? '⚡' : '🟢';
  const statusMessage = isFull
    ? 'المجموعة الحالية اكتملت — احجز الآن لتكون أول شخص في المجموعة الجديدة'
    : isAlmostFull
    ? `لم يتبق سوى ${remaining} مقاعد! احجز الآن قبل نفادها`
    : `مازال متسع — ${remaining} مقعد متاح`;

  // Compact variant - for CourseCard
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`} style={{ minWidth: '120px' }}>
        <div className="relative w-16 h-2 rounded-full overflow-hidden flex-1" style={{ backgroundColor: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-expo relative"
            style={{
              width: `${Math.min(displayProgress, 100)}%`,
              background: gradient,
              boxShadow: `0 0 8px ${colors.glow}`,
            }}
          />
        </div>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: colors.text }}>
          {Math.round(displayProgress)}%
        </span>
      </div>
    );
  }

  // Card variant - for sidebar
  if (variant === 'card') {
    return (
      <div
        ref={containerRef}
        className={`p-4 rounded-2xl relative overflow-hidden ${className}`}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{label}</span>
          <span className="text-xs font-bold" style={{ color: colors.glow }}>
            {current} / {max} طالب
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-expo relative"
            style={{
              width: `${Math.min(displayProgress, 100)}%`,
              background: gradient,
              boxShadow: `0 0 20px ${colors.glow}`,
            }}
          >
            <div className="absolute inset-0 animate-shimmer rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
          </div>

          {/* Milestone dots */}
          {showMilestones && [25, 50, 75, 100].map((milestone) => (
            <div
              key={milestone}
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${milestone}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: displayProgress >= milestone ? colors.glow : 'var(--border)',
                  transform: displayProgress >= milestone ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: displayProgress >= milestone ? `0 0 8px ${colors.glow}` : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Status Message */}
        <p className="text-xs text-center font-medium" style={{ color: colors.glow }}>
          {statusMessage}
        </p>
      </div>
    );
  }

  // Detailed variant - with milestones
  if (variant === 'detailed') {
    return (
      <div
        ref={containerRef}
        className={`p-5 rounded-2xl relative overflow-hidden ${className}`}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{label}</span>
          <span className="text-xs font-bold" style={{ color: colors.glow }}>
            {current} / {max} طالب
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-expo relative"
            style={{
              width: `${Math.min(displayProgress, 100)}%`,
              background: gradient,
              boxShadow: `0 0 20px ${colors.glow}`,
            }}
          >
            <div className="absolute inset-0 animate-shimmer rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
          </div>

          {/* Milestone dots */}
          {showMilestones && [25, 50, 75, 100].map((milestone) => (
            <div
              key={milestone}
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${milestone}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: displayProgress >= milestone ? colors.glow : 'var(--border)',
                  transform: displayProgress >= milestone ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: displayProgress >= milestone ? `0 0 8px ${colors.glow}` : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Status Message */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-lg" aria-hidden="true">{statusIcon}</span>
          <p className="text-xs text-center font-medium" style={{ color: colors.glow }}>
            {statusMessage}
          </p>
        </div>

        {/* Milestone indicators */}
        <div className="flex justify-between pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          {[25, 50, 75, 100].map((milestone) => (
            <div key={milestone} className="text-center flex-1">
              <div className="w-2 h-2 rounded-full mx-auto mb-1 transition-all duration-500" style={{
                backgroundColor: displayProgress >= milestone ? colors.glow : 'var(--border)',
                transform: displayProgress >= milestone ? 'scale(1.3)' : 'scale(1)',
                boxShadow: displayProgress >= milestone ? `0 0 8px ${colors.glow}` : 'none',
              }} />
              <span className="text-[10px] font-bold" style={{
                color: displayProgress >= milestone ? colors.glow : 'var(--text-light)',
              }}>
                {milestone}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      ref={containerRef}
      className={`p-4 md:p-5 rounded-2xl relative overflow-hidden ${className}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: colors.glow }}>
          {current} / {max} طالب
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-expo relative"
          style={{
            width: `${Math.min(displayProgress, 100)}%`,
            background: gradient,
            boxShadow: `0 0 20px ${colors.glow}`,
          }}
        >
          <div className="absolute inset-0 animate-shimmer rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
        </div>

        {showMilestones && [25, 50, 75, 100].map((milestone) => (
          <div
            key={milestone}
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left: `${milestone}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: displayProgress >= milestone ? colors.glow : 'var(--border)',
                transform: displayProgress >= milestone ? 'scale(1.3)' : 'scale(1)',
                boxShadow: displayProgress >= milestone ? `0 0 8px ${colors.glow}` : 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Status Message */}
      <p className="text-xs text-center font-medium" style={{ color: colors.glow }}>
        {statusMessage}
      </p>
    </div>
  );
}

/* Circular Progress for CourseCard */
interface CircularProgressProps {
  current: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  className?: string;
}

export function CircularProgress({
  current,
  max,
  size = 60,
  strokeWidth = 4,
  showPercentage = true,
  className = '',
}: CircularProgressProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isFull = pct >= 100;
  const isAlmostFull = pct >= 80;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const getColor = () => {
    if (isFull) return '#dc2626';
    if (isAlmostFull) return '#d97706';
    return '#16a34a';
  };

  const color = getColor();

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-expo"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>

      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: color }}>
            {Math.round(pct)}%
          </span>
        </div>
      )}
    </div>
  );
}

/* Progress Steps for multi-step processes */
interface ProgressStepsProps {
  steps: Array<{
    label: string;
    completed?: boolean;
    current?: boolean;
    icon?: string;
  }>;
  className?: string;
}

export function ProgressSteps({
  steps,
  className = '',
}: ProgressStepsProps) {
  const { primaryColor } = useBranding();

  return (
    <div className={`flex items-center ${className}`} role="list" aria-label="خطوات التقدم">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1 relative" role="listitem">
          {/* Connecting line */}
          {index < steps.length - 1 && (
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 -ml-2 mr-2 z-0"
              style={{
                backgroundColor: step.completed ? primaryColor : 'var(--border)',
              }}
              aria-hidden="true"
            />
          )}

          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                step.completed
                  ? 'bg-[var(--primary)] text-white'
                  : step.current
                  ? 'bg-[var(--primary)] text-white animate-pulse-soft ring-4'
                  : 'bg-[var(--bg)] border-2'
              }`}
              style={{
                borderColor: step.current ? 'var(--primary)' : step.completed ? 'var(--primary)' : 'var(--border)',
                boxShadow: step.current ? '0 0 0 4px rgba(37,99,235,0.3)' : 'none',
              }}
            >
              {step.completed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : step.icon ? (
                <span aria-hidden="true">{step.icon}</span>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            <span
              className={`text-xs font-medium text-center transition-colors ${
                step.current ? 'text-[var(--primary)]' : step.completed ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}