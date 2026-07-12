'use client';

import { useState } from 'react';
import { useBranding } from '../BrandingProvider';

interface InfoCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'elevated' | 'glass' | 'gradient' | 'bordered';
  color?: string;
  hoverable?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  animated?: boolean;
  delay?: number;
}

export function InfoCard({
  icon,
  label,
  value,
  subtitle,
  variant = 'default',
  color,
  hoverable = true,
  onClick,
  children,
  className = '',
  animated = true,
  delay = 0,
}: InfoCardProps) {
  const { primaryColor, secondaryColor } = useBranding();
  const [isHovered, setIsHovered] = useState(false);
  const cardColor = color || primaryColor;

  const variants = {
    default: `
      bg-[var(--card)]
      border border-[var(--border)]
      hover:border-[var(--primary)]
      hover:shadow-lg
    `,
    elevated: `
      bg-[var(--card)]
      border border-[var(--border)]
      shadow-lg
      hover:shadow-xl
    `,
    glass: `
      glass-card
      hover:bg-[var(--glass-bg-strong)]
    `,
    gradient: `
      bg-gradient-to-br from-[var(--card)] to-[var(--bg)]
      border border-[var(--border)]
      relative overflow-hidden
    `,
    bordered: `
      bg-[var(--card)]
      border-2 border-[var(--border)]
      hover:border-[var(--primary)]
    `,
  };

  const baseClasses = `
    relative rounded-2xl p-5 md:p-6
    transition-all duration-300 ease-expo
    flex flex-col items-center text-center
    ${variants[variant]}
    ${hoverable && !onClick ? 'cursor-pointer hover:-translate-y-1' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${animated ? 'animate-fade-up' : ''}
  `;

  const gradientVariant = variant === 'gradient' ? (
    <>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${cardColor}10, ${secondaryColor}10)`,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${cardColor}, ${secondaryColor})`,
        }}
        aria-hidden="true"
      />
    </>
  ) : null;

  const iconWrapper = (
    <div
      className={`relative inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl mb-4 transition-all duration-500 ${hoverable ? 'group-hover:scale-110 group-hover:rotate-3' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${cardColor}15, ${secondaryColor}15)`,
        boxShadow: `0 0 30px ${cardColor}20`,
      }}
      aria-hidden="true"
    >
      <span className="text-2xl md:text-3xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
        {icon}
      </span>
      {animated && (
        <div
          className="absolute inset-0 rounded-2xl animate-pulse-soft opacity-20"
          style={{
            background: `linear-gradient(135deg, ${cardColor}, ${secondaryColor})`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );

  return (
    <article
      className={`${baseClasses} ${className}`}
      style={{
        animationDelay: `${delay * 0.1}s`,
        animationFillMode: 'both',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      {gradientVariant}
      {children ? (
        <div className="relative z-10 w-full">{children}</div>
      ) : (
        <>
          {/* Icon */}
          {iconWrapper}

          {/* Value */}
          <div className="mb-2 relative z-10">
            <span
              className="text-3xl md:text-4xl font-extrabold gradient-text"
              style={{
                background: `linear-gradient(135deg, ${cardColor}, ${secondaryColor})`,
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          </div>

          {/* Label */}
          <p className="text-sm md:text-base font-semibold mb-1 relative z-10" style={{ color: 'var(--text)' }}>
            {label}
          </p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs relative z-10" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </>
      )}

      {/* Hover shine effect */}
      {hoverable && (
        <div
          className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${cardColor}10, ${secondaryColor}10)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Click ripple effect */}
      {onClick && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at center, ${cardColor}30 0%, transparent 70%)`,
              transform: isHovered ? 'scale(1)' : 'scale(0)',
              opacity: isHovered ? 0 : 1,
              transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
            }}
            aria-hidden="true"
          />
        </div>
      )}
    </article>
  );
}

/* Horizontal variant for inline use */
interface HorizontalInfoCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  className?: string;
}

export function HorizontalInfoCard({
  icon,
  label,
  value,
  color,
  className = '',
}: HorizontalInfoCardProps) {
  const { primaryColor } = useBranding();
  const cardColor = color || primaryColor;

  return (
    <div
      className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl glass-card transition-all duration-300 ${className}`}
      style={{ borderColor: 'var(--glass-border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${cardColor}15, ${cardColor}25)`,
        }}
        aria-hidden="true"
      >
        <span>{icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold gradient-text" style={{
          background: `linear-gradient(135deg, ${cardColor}, ${primaryColor})`,
        }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

{/* Grid layout for multiple info cards */}
interface InfoGridProps {
  cards: Array<{
    icon: string;
    label: string;
    value: string | number;
    subtitle?: string;
    color?: string;
    variant?: 'default' | 'elevated' | 'glass' | 'gradient' | 'bordered';
  }>;
  columns?: 2 | 3 | 4 | 5;
  gap?: 2 | 3 | 4 | 5;
  className?: string;
}

export function InfoGrid({
  cards,
  columns = 4,
  gap = 4,
  className = '',
}: InfoGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  const gapClasses = {
    2: 'gap-3',
    3: 'gap-4',
    4: 'gap-4 md:gap-6',
    5: 'gap-4 md:gap-6',
  };

  return (
    <div
      className={`${columnClasses[columns as 2 | 3 | 4 | 5]} ${gapClasses[gap as 2 | 3 | 4 | 5]} ${className}`}
      role="list"
      aria-label="معلومات الكورس"
    >
      {cards.map((card, index) => (
        <InfoCard
          key={index}
          {...card}
          delay={index}
          animated={true}
        />
      ))}
    </div>
  );
}

/* Stat card with trend indicator */
interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  color?: string;
  variant?: 'default' | 'elevated' | 'glass';
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  color,
  variant = 'default',
  className = '',
}: StatCardProps) {
  const { primaryColor } = useBranding();
  const cardColor = color || primaryColor;

  return (
    <InfoCard
      icon={icon}
      label={label}
      value={value}
      variant={variant}
      color={cardColor}
      className={className}
      children={
        trend && (
          <div
            className={`mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${trend.isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            style={{
              backgroundColor: trend.isPositive ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
              color: trend.isPositive ? '#16a34a' : '#dc2626',
            }}
          >
            <span aria-hidden="true">{trend.isPositive ? '↑' : '↓'}</span>
            <span>{trend.value}%</span>
            <span style={{ color: trend.isPositive ? '#16a34a99' : '#dc262699' }}>{trend.label}</span>
          </div>
        )
      }
    />
  );
}