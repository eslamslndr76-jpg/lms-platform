'use client';

import { useState, useRef, useEffect } from 'react';
import { useBranding } from '../BrandingProvider';

interface Lesson {
  id: number | string;
  title: string;
  duration?: string;
  type?: 'video' | 'reading' | 'quiz' | 'assignment' | 'live';
  isFree?: boolean;
  isCompleted?: boolean;
  isLocked?: boolean;
  description?: string;
  resources?: Array<{
    name: string;
    type: string;
    url: string;
  }>;
}

interface Module {
  id: number | string;
  title: string;
  description?: string;
  lessons: Lesson[];
  isCompleted?: boolean;
  progress?: number;
}

interface CurriculumAccordionProps {
  modules: Module[];
  onLessonClick?: (lesson: Lesson, module: Module) => void;
  className?: string;
  showProgress?: boolean;
  defaultOpenModules?: (string | number)[];
  completedLessons?: (string | number)[];
}

export function CurriculumAccordion({
  modules,
  onLessonClick,
  className = '',
  showProgress = true,
  defaultOpenModules = [],
  completedLessons = [],
}: CurriculumAccordionProps) {
  const { primaryColor, secondaryColor } = useBranding();
  const [openModules, setOpenModules] = useState<(string | number)[]>(defaultOpenModules);
  const [hoveredLesson, setHoveredLesson] = useState<string | number | null>(null);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalCompleted = modules.reduce((sum, m) =>
    sum + m.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length, 0);

  const toggleModule = (moduleId: string | number) => {
    setOpenModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleLessonClick = (lesson: Lesson, module: Module) => {
    if (lesson.isLocked) return;
    onLessonClick?.(lesson, module);
  };

  const getLessonIcon = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return '🎬';
      case 'reading': return '📖';
      case 'quiz': return '📝';
      case 'assignment': return '📋';
      case 'live': return '📺';
      default: return '📄';
    }
  };

  const getLessonColor = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return primaryColor;
      case 'reading': return '#16a34a';
      case 'quiz': return '#f59e0b';
      case 'assignment': return '#7c3aed';
      case 'live': return '#dc2626';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <section
      className={`space-y-4 ${className}`}
      aria-label="محتوى الكورس"
    >
      {/* Overall Progress Header */}
      {showProgress && totalLessons > 0 && (
        <div className="p-4 rounded-2xl glass-card" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ color: 'var(--text)' }}>تقدمك في الكورس</h3>
            <span className="text-sm font-bold gradient-text">
              {totalCompleted} / {totalLessons} درس
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-expo"
              style={{
                width: `${totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                boxShadow: `0 0 15px ${primaryColor}40`,
              }}
            />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            {Math.round(totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0)}% مكتمل
          </p>
        </div>
      )}

      {/* Modules */}
      <div className="space-y-3" role="list" aria-label="وحدات الكورس">
        {modules.map((module, moduleIndex) => {
          const isOpen = openModules.includes(module.id);
          const completedCount = module.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length;
          const moduleProgress = module.lessons.length > 0 ? Math.round((completedCount / module.lessons.length) * 100) : 0;
          const isModuleCompleted = moduleProgress === 100;

          return (
            <article
              key={module.id}
              className="rounded-2xl overflow-hidden glass-card transition-all duration-300"
              style={{
                borderColor: isOpen ? `${primaryColor}40` : 'var(--glass-border)',
                boxShadow: isOpen ? `var(--shadow-lg), 0 0 30px ${primaryColor}15` : 'var(--shadow-md)',
              }}
              role="listitem"
            >
              {/* Module Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full p-4 md:p-5 flex items-center justify-between gap-4 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
                aria-expanded={isOpen}
                aria-controls={`module-${module.id}-content`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Module Number */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-extrabold transition-all duration-300"
                    style={{
                      background: isModuleCompleted
                        ? `linear-gradient(135deg, #16a34a, #22c55e)`
                        : isOpen
                        ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                        : 'var(--bg)',
                      color: isModuleCompleted || isOpen ? 'white' : 'var(--text-muted)',
                    }}
                    aria-hidden="true"
                  >
                    {isModuleCompleted ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <span>{moduleIndex + 1}</span>
                    )}
                  </div>

                  {/* Module Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-lg truncate" style={{ color: 'var(--text)' }}>
                      {module.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <span aria-hidden="true">📚</span>
                        {module.lessons.length} درس
                      </span>

                      {module.description && (
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <span aria-hidden="true">📝</span>
                          {module.description}
                        </span>
                      )}

                      {/* Duration */}
                      {module.lessons.some(l => l.duration) && (
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <span aria-hidden="true">⏱</span>
                          {module.lessons
                            .filter(l => l.duration)
                            .reduce((sum, l) => {
                              const match = l.duration?.match(/(\d+)/);
                              return sum + (match ? parseInt(match[1]) : 0);
                            }, 0)} دقيقة
                        </span>
                      )}

                      {/* Module Progress */}
                      {showProgress && module.lessons.length > 0 && (
                        <div className="flex-1 min-w-[100px] max-w-[200px] h-2 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${moduleProgress}%`,
                              background: isModuleCompleted
                                ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                : `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`flex-shrink-0 w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Module Content */}
              <div
                id={`module-${module.id}-content`}
                className="overflow-hidden transition-all duration-300 ease-expo"
                style={{
                  maxHeight: isOpen ? '2000px' : '0',
                  opacity: isOpen ? 1 : 0,
                  padding: isOpen ? '0 4px 4px 4px' : '0 4px',
                }}
                role="region"
                aria-label={`محتوى الوحدة: ${module.title}`}
              >
                {isOpen && (
                  <div className="space-y-2 pr-4 border-r-2 animate-fade-up" style={{ borderColor: `${primaryColor}30` }}>
                    {module.lessons.map((lesson, lessonIndex) => {
                      const isCompleted = completedLessons.includes(lesson.id) || lesson.isCompleted;
                      const isLocked = lesson.isLocked;
                      const lessonColor = getLessonColor(lesson.type);
                      const isHovered = hoveredLesson === lesson.id;

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => handleLessonClick(lesson, module)}
                          onMouseEnter={() => setHoveredLesson(lesson.id)}
                          onMouseLeave={() => setHoveredLesson(null)}
                          disabled={isLocked}
                          className={`w-full relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--bg)] cursor-pointer'} ${isCompleted ? 'completed' : ''}`}
                          style={{
                            borderColor: isCompleted ? `${lessonColor}40` : isHovered ? `${lessonColor}30` : 'transparent',
                            backgroundColor: isCompleted ? `${lessonColor}08` : 'transparent',
                          }}
                          aria-disabled={isLocked}
                          aria-current={isCompleted ? 'true' : undefined}
                        >
                          {/* Completion indicator */}
                          <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300" style={{
                            backgroundColor: isCompleted
                              ? lessonColor
                              : isHovered && !isLocked
                              ? `${lessonColor}15`
                              : 'var(--bg)',
                            borderColor: isCompleted ? lessonColor : isHovered && !isLocked ? `${lessonColor}30` : 'var(--border)',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }}>
                            {isCompleted ? (
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-lg" aria-hidden="true">{getLessonIcon(lesson.type)}</span>
                            )}
                          </div>

                          {/* Lesson Info */}
                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="font-medium truncate flex-1"
                                style={{ color: isLocked ? 'var(--text-muted)' : 'var(--text)' }}
                              >
                                {lesson.title}
                              </span>

                              {lesson.isFree && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#16a34a15', color: '#16a34a' }}>
                                  <span aria-hidden="true">🆓</span>
                                  مجاني
                                </span>
                              )}

                              {isLocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                                  <span aria-hidden="true">🔒</span>
                                  مغلق
                                </span>
                              )}

                              {lesson.duration && (
                                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {lesson.duration}
                                </span>
                              )}
                            </div>

                            {lesson.description && (
                              <p className="text-xs line-clamp-1 truncate" style={{ color: 'var(--text-muted)' }}>
                                {lesson.description}
                              </p>
                            )}

                            {/* Resources */}
                            {lesson.resources && lesson.resources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {lesson.resources.slice(0, 3).map((resource, i) => (
                                  <a
                                    key={i}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                                    style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                  >
                                    <span aria-hidden="true">📎</span>
                                    {resource.name}
                                  </a>
                                ))}
                                {lesson.resources.length > 3 && (
                                  <span className="text-[10px]" style={{ color: 'var(--text-light)' }}>
                    +{lesson.resources.length - 3} مورد آخر
                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action indicator */}
                          {!isLocked && (
                            <div className="flex-shrink-0 flex items-center gap-1 text-sm font-medium opacity-0 transition-all duration-300" style={{ color: lessonColor }}>
                              <span aria-hidden="true">{isCompleted ? 'مكتمل ✓' : 'ابدأ التعلم'}</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                            </div>
                          )}

                          {/* Hover shine */}
                          {!isLocked && (
                            <div
                              className="absolute inset-0 rounded-xl pointer-events-none"
                              style={{
                                opacity: isHovered ? 1 : 0,
                                background: `linear-gradient(90deg, transparent, ${lessonColor}10, transparent)`,
                                transition: 'opacity 0.3s',
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* Add lesson CTA if module is not full */}
                    <button
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 border-2 border-dashed"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--text-muted)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium">إضافة درس جديد</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty State */}
      {modules.length === 0 && (
        <div className="text-center py-12 rounded-2xl glass-card" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="text-6xl mb-4" aria-hidden="true">📚</div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>لا يوجد محتوى بعد</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>سيتم إضافة الوحدات والدروس قريباً</p>
        </div>
      )}
    </section>
  );
}

/* Compact Curriculum for sidebar */
export function CompactCurriculum({
  modules,
  onLessonClick,
  completedLessons = [],
}: CurriculumAccordionProps) {
  const { primaryColor } = useBranding();
  const [openModule, setOpenModule] = useState<string | number | null>(modules[0]?.id || null);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalCompleted = modules.reduce((sum, m) =>
    sum + m.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length, 0);

  return (
    <div className="space-y-2">
      {/* Progress */}
      <div className="p-3 rounded-xl glass-card" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>تقدم الكورس</span>
          <span className="text-sm font-bold gradient-text">{totalCompleted}/{totalLessons}</span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}dd)`,
            }}
          />
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {modules.map((module, i) => {
          const isOpen = openModule === module.id;
          const completedCount = module.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length;
          const progress = module.lessons.length > 0 ? Math.round((completedCount / module.lessons.length) * 100) : 0;

          return (
            <div key={module.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
              <button
                onClick={() => setOpenModule(isOpen ? null : module.id)}
                className="w-full p-3 flex items-center gap-3 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                aria-expanded={isOpen}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: progress === 100
                      ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                      : isOpen
                      ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
                      : 'var(--bg-elevated)',
                    color: progress === 100 || isOpen ? 'white' : 'var(--text)',
                    border: progress === 100 || isOpen ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {progress === 100 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    i + 1
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{module.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{module.lessons.length} درس</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                          : `linear-gradient(90deg, ${primaryColor}, ${primaryColor}dd)`,
                      }} />
                    </div>
                  </div>
                </div>

                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {isOpen && (
                <div className="pr-11 animate-slide-up" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {module.lessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id) || lesson.isCompleted;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onLessonClick?.(lesson, module)}
                        disabled={lesson.isLocked}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${lesson.isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--bg-elevated)] cursor-pointer'} ${isCompleted ? 'completed' : ''}`}
                        style={{
                          backgroundColor: isCompleted ? `rgba(22,163,74,0.08)` : 'transparent',
                        }}
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: isCompleted ? '#16a34a' : 'var(--bg-elevated)',
                          border: isCompleted ? 'none' : '1px solid var(--border)',
                        }}>
                          {isCompleted ? (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                          ) : (
                            <span className="text-xs">📄</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate flex-1" style={{ color: lesson.isLocked ? 'var(--text-muted)' : 'var(--text)' }}>
                          {lesson.title}
                        </span>
                        {lesson.duration && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{lesson.duration}</span>}
                        {lesson.isFree && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#16a34a15', color: '#16a34a' }}>مجاني</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}