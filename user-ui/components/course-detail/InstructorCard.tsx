'use client';

import { useState } from 'react';
import { useBranding } from '../BrandingProvider';

interface InstructorCardProps {
  instructor: {
    name: string;
    title?: string;
    bio?: string;
    avatar?: string;
    rating?: number;
    studentsCount?: number;
    coursesCount?: number;
    reviewsCount?: number;
    experience?: string;
    socialLinks?: {
      twitter?: string;
      linkedin?: string;
      website?: string;
      youtube?: string;
    };
    badges?: Array<{
      icon: string;
      label: string;
      color?: string;
    }>;
  };
  variant?: 'default' | 'compact' | 'detailed' | 'sidebar';
  showSocial?: boolean;
  showStats?: boolean;
  className?: string;
  onClick?: () => void;
}

export function InstructorCard({
  instructor,
  variant = 'default',
  showSocial = true,
  showStats = true,
  className = '',
  onClick,
}: InstructorCardProps) {
  const { primaryColor, secondaryColor } = useBranding();
  const [isHovered, setIsHovered] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);

  const rating = instructor.rating || 4.9;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-3 p-3 rounded-xl glass-card transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : 'article'}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="relative w-14 h-14 rounded-full flex-shrink-0 overflow-hidden" style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        }}>
          {instructor.avatar ? (
            <img src={instructor.avatar} alt={instructor.name} className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
              {instructor.name.charAt(0)}
            </span>
          )}
          {instructor.rating && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: '#f59e0b' }}>
              {rating.toFixed(1)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate" style={{ color: 'var(--text)' }}>{instructor.name}</p>
          {instructor.title && (
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{instructor.title}</p>
          )}
          {instructor.rating && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs" style={{ color: '#f59e0b' }}>
                {'★'.repeat(fullStars)}{hasHalfStar ? '☆' : ''}{'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({instructor.studentsCount?.toLocaleString() || '0'} طلاب)</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={`p-4 rounded-2xl glass-card transition-all duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : ''} ${className}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : 'article'}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="flex items-start gap-4">
          <div className="relative w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden" style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          }}>
            {instructor.avatar ? (
              <img src={instructor.avatar} alt={instructor.name} className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">
                {instructor.name.charAt(0)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold mb-1" style={{ color: 'var(--text)' }}>{instructor.name}</h4>
            {instructor.title && (
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{instructor.title}</p>
            )}

            {showStats && (instructor.studentsCount || instructor.coursesCount) && (
              <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                {instructor.studentsCount && (
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true">👥</span>
                    {instructor.studentsCount.toLocaleString()} طالب
                  </span>
                )}
                {instructor.coursesCount && (
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true">📚</span>
                    {instructor.coursesCount} كورس
                  </span>
                )}
              </div>
            )}

            {instructor.rating && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-sm" style={{ color: '#f59e0b' }}>
                  {'★'.repeat(fullStars)}{hasHalfStar ? '☆' : ''}{'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{rating}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({instructor.reviewsCount || 0} تقييم)</span>
              </div>
            )}

            {showSocial && instructor.socialLinks && (
              <div className="flex gap-2 mt-3">
                {instructor.socialLinks.linkedin && (
                  <a href={instructor.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: 'rgba(0,119,181,0.1)', color: '#0077b5' }} aria-label="LinkedIn">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                )}
                {instructor.socialLinks.twitter && (
                  <a href={instructor.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: 'rgba(29,161,242,0.1)', color: '#1da1f2' }} aria-label="Twitter">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
                  </a>
                )}
                {instructor.socialLinks.youtube && (
                  <a href={instructor.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: '#ff0000' }} aria-label="YouTube">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 7.685 0 12 0 12s0 4.315.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 16.315 24 12 24 12s0-4.315-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                )}
                {instructor.socialLinks.website && (
                  <a href={instructor.socialLinks.website} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: `rgba(37,99,235,0.1)`, color: primaryColor }} aria-label="الموقع الشخصي">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {instructor.badges && instructor.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {instructor.badges.map((badge, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold" style={{
                backgroundColor: `${badge.color || primaryColor}15`,
                color: badge.color || primaryColor,
              }}>
                <span aria-hidden="true">{badge.icon}</span>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default / Detailed variant
  return (
    <article
      className={`relative overflow-hidden rounded-2xl p-6 md:p-8 glass-card transition-all duration-500 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        border: '1px solid var(--glass-border)',
        boxShadow: isHovered ? 'var(--shadow-xl), var(--shadow-glow)' : 'var(--shadow-lg)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top right, ${primaryColor}10, transparent 50%),
                      radial-gradient(ellipse at bottom left, ${secondaryColor}10, transparent 50%)`,
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5 mb-6">
        {/* Avatar */}
        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl flex-shrink-0 overflow-hidden" style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          boxShadow: `0 0 40px ${primaryColor}30, 0 8px 30px rgba(0,0,0,0.15)`,
        }}>
          {instructor.avatar ? (
            <img src={instructor.avatar} alt={instructor.name} className="w-full h-full object-cover transition-transform duration-500" style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white font-extrabold text-4xl md:text-5xl">
              {instructor.name.charAt(0)}
            </span>
          )}

          {/* Rating badge */}
          {instructor.rating && (
            <div className="absolute -bottom-2 -right-2 md:-bottom-3 md:-right-3 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base font-extrabold text-white shadow-lg" style={{
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 20px rgba(245,158,11,0.5)',
            }}>
              {rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-center md:text-right">
          <h3 className="text-2xl md:text-3xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>
            {instructor.name}
          </h3>

          {instructor.title && (
            <p className="text-lg mb-2 gradient-text" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
              {instructor.title}
            </p>
          )}

          {/* Stats */}
          {showStats && (instructor.studentsCount || instructor.coursesCount || instructor.experience) && (
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 md:gap-6 mt-3">
              {instructor.studentsCount && (
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true">👥</span>
                  <span className="font-bold">{instructor.studentsCount.toLocaleString()}+</span>
                  <span className="text-sm">طالب</span>
                </div>
              )}
              {instructor.coursesCount && (
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true">📚</span>
                  <span className="font-bold">{instructor.coursesCount}</span>
                  <span className="text-sm">كورس</span>
                </div>
              )}
              {instructor.experience && (
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true">💼</span>
                  <span className="font-bold">{instructor.experience}</span>
                  <span className="text-sm">خبرة</span>
                </div>
              )}
              {instructor.rating && (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg" style={{ color: '#f59e0b' }}>
                    {'★'.repeat(fullStars)}{hasHalfStar ? '☆' : ''}{'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--text)' }}>{rating}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>({instructor.reviewsCount || 0} تقييم)</span>
                </div>
              )}
            </div>
          )}

          {/* Social Links */}
          {showSocial && instructor.socialLinks && (
            <div className="flex justify-center md:justify-end gap-2 mt-4">
              {instructor.socialLinks.linkedin && (
                <a href={instructor.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ backgroundColor: 'rgba(0,119,181,0.1)', color: '#0077b5' }} aria-label="LinkedIn">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              )}
              {instructor.socialLinks.twitter && (
                <a href={instructor.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ backgroundColor: 'rgba(29,161,242,0.1)', color: '#1da1f2' }} aria-label="Twitter">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>
                </a>
              )}
              {instructor.socialLinks.youtube && (
                <a href={instructor.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: '#ff0000' }} aria-label="YouTube">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 7.685 0 12 0 12s0 4.315.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 16.315 24 12 24 12s0-4.315-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              )}
              {instructor.socialLinks.website && (
                <a href={instructor.socialLinks.website} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ backgroundColor: `rgba(37,99,235,0.1)`, color: primaryColor }} aria-label="الموقع الشخصي">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {instructor.bio && (
        <div className="relative z-10 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg" aria-hidden="true">📖</span>
            <h4 className="font-bold" style={{ color: 'var(--text)' }}>عن المدرب</h4>
          </div>
          <div
            className="prose prose-ar max-w-none"
            style={{
              color: 'var(--text-secondary)',
              lineHeight: '1.8',
              maxHeight: showFullBio ? 'none' : '120px',
              overflow: showFullBio ? 'visible' : 'hidden',
              position: 'relative',
            }}
          >
            <p>{instructor.bio}</p>
          </div>
          {!showFullBio && instructor.bio.length > 200 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowFullBio(true); }}
              className="inline-flex items-center gap-1 text-sm font-medium mt-2 transition-colors"
              style={{ color: primaryColor }}
            >
              قراءة المزيد
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
          )}
          {showFullBio && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowFullBio(false); }}
              className="inline-flex items-center gap-1 text-sm font-medium mt-2 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              إظهار أقل
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
            </button>
          )}
        </div>
      )}

      {/* Badges */}
      {instructor.badges && instructor.badges.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-2">
          {instructor.badges.map((badge, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: `${badge.color || primaryColor}15`,
                color: badge.color || primaryColor,
                border: `1px solid ${badge.color || primaryColor}30`,
              }}
            >
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

/* Instructor List for multiple instructors */
interface InstructorListProps {
  instructors: InstructorCardProps['instructor'][];
  variant?: 'grid' | 'carousel' | 'stacked';
  maxVisible?: number;
  className?: string;
}

export function InstructorList({
  instructors,
  variant = 'grid',
  maxVisible = 4,
  className = '',
}: InstructorListProps) {
  const displayInstructors = instructors.slice(0, maxVisible);
  const remaining = instructors.length - maxVisible;

  if (variant === 'carousel') {
    return (
      <div className={`flex gap-4 overflow-x-auto pb-4 scrollbar-hide ${className}`} role="list" aria-label="فريق المدربين">
        {displayInstructors.map((instructor, index) => (
          <InstructorCard key={index} instructor={instructor} variant="sidebar" />
        ))}
        {remaining > 0 && (
          <div className="flex-shrink-0 w-56 flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="text-center p-4 rounded-2xl glass-card">
              <span className="text-4xl font-extrabold gradient-text">+{remaining}</span>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>مدرب إضافي</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`space-y-3 ${className}`} role="list" aria-label="فريق المدربين">
        {displayInstructors.map((instructor, index) => (
          <InstructorCard key={index} instructor={instructor} variant="compact" />
        ))}
        {remaining > 0 && (
          <div className="text-center py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            و {remaining} مدرب{remaining > 1 ? 'ين' : ''} آخرون...
          </div>
        )}
      </div>
    );
  }

  // Grid variant
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`} role="list" aria-label="فريق المدربين">
      {displayInstructors.map((instructor, index) => (
        <InstructorCard key={index} instructor={instructor} variant="sidebar" />
      ))}
      {remaining > 0 && (
        <div className="col-span-full flex items-center justify-center">
          <button className="px-6 py-4 rounded-2xl glass-card text-center w-full transition-all hover:shadow-lg" style={{ borderColor: 'var(--glass-border)' }}>
            <span className="text-2xl font-extrabold gradient-text">+{remaining}</span>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>مدرب إضافي - عرض الكل</p>
          </button>
        </div>
      )}
    </div>
  );
}