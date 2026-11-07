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
      case 'video': return 'play_circle';
      case 'reading': return 'menu_book';
      case 'quiz': return 'edit_note';
      case 'assignment': return 'assignment';
      case 'live': return 'videocam';
      default: return 'description';
    }
  };

  const getLessonColor = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return primaryColor;
      case 'reading': return '#16a34a';
      case 'quiz': return '#f59e0b';
      case 'assignment': return '#7c3aed';
      case 'live': return '#dc2626';
      default: return 'var(--md-sys-color-on-surface-variant)';
    }
  };

  return (
    <section
      className={`space-y-4 ${className}`}
      aria-label="محتوى الكورس"
    >
      {showProgress && totalLessons > 0 && (
        <div className="p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '16px' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>تقدمك في الكورس</h3>
            <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>
              {totalCompleted} / {totalLessons} درس
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-expo"
              style={{
                width: `${totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
              }}
            />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {Math.round(totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0)}% مكتمل
          </p>
        </div>
      )}

      <div className="space-y-3" role="list" aria-label="وحدات الكورس">
        {modules.map((module, moduleIndex) => {
          const isOpen = openModules.includes(module.id);
          const completedCount = module.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length;
          const moduleProgress = module.lessons.length > 0 ? Math.round((completedCount / module.lessons.length) * 100) : 0;
          const isModuleCompleted = moduleProgress === 100;

          return (
            <article
              key={module.id}
              className="overflow-hidden transition-all duration-300"
              style={{
                borderRadius: '16px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: isOpen ? `1px solid ${primaryColor}40` : '1px solid var(--md-sys-color-outline-variant)',
              }}
              role="listitem"
            >
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full p-4 md:p-5 flex items-center justify-between gap-4 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2"
                style={{ '--tw-ring-offset-color': 'var(--md-sys-color-surface-container)' } as React.CSSProperties}
                aria-expanded={isOpen}
                aria-controls={`module-${module.id}-content`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-md3-sm flex items-center justify-center text-xl font-extrabold transition-all duration-300"
                    style={{
                      background: isModuleCompleted
                        ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                        : isOpen
                        ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isModuleCompleted || isOpen ? 'white' : 'var(--md-sys-color-on-surface-variant)',
                    }}
                    aria-hidden="true"
                  >
                    {isModuleCompleted ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>check</span>
                    ) : (
                      <span>{moduleIndex + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-lg truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      {module.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-sm flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>menu_book</span>
                        {module.lessons.length} درس
                      </span>

                      {module.description && (
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span>
                          {module.description}
                        </span>
                      )}

                      {module.lessons.some(l => l.duration) && (
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
                          {module.lessons
                            .filter(l => l.duration)
                            .reduce((sum, l) => {
                              const match = l.duration?.match(/(\d+)/);
                              return sum + (match ? parseInt(match[1]) : 0);
                            }, 0)} دقيقة
                        </span>
                      )}

                      {showProgress && module.lessons.length > 0 && (
                        <div className="flex-1 min-w-[100px] max-w-[200px] h-2 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
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

                  <span
                    className="material-symbols-outlined flex-shrink-0 transition-transform duration-300"
                    style={{
                      fontSize: '24px',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </div>
              </button>

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
                  <div className="space-y-2 pr-4 animate-fade-up" style={{ borderRight: `2px solid ${primaryColor}30` }}>
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
                          className={`w-full relative flex items-center gap-3 p-3 rounded-md3-sm transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer'} ${isCompleted ? 'completed' : ''}`}
                          style={{
                            backgroundColor: isCompleted ? `${lessonColor}08` : 'transparent',
                          }}
                          aria-disabled={isLocked}
                          aria-current={isCompleted ? 'true' : undefined}
                        >
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded-md3-sm flex items-center justify-center transition-all duration-300"
                            style={{
                              backgroundColor: isCompleted
                                ? lessonColor
                                : isHovered && !isLocked
                                ? `${lessonColor}15`
                                : 'var(--md-sys-color-surface-container-high)',
                            }}
                          >
                            {isCompleted ? (
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'white' }}>check</span>
                            ) : (
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: lessonColor }}>
                                {getLessonIcon(lesson.type)}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="font-medium truncate flex-1"
                                style={{ color: isLocked ? 'var(--md-sys-color-on-surface-variant)' : 'var(--md-sys-color-on-surface)' }}
                              >
                                {lesson.title}
                              </span>

                              {lesson.isFree && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                                >
                                  مجاني
                                </span>
                              )}

                              {isLocked && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>lock</span>
                                  مغلق
                                </span>
                              )}

                              {lesson.duration && (
                                <span className="text-xs flex-shrink-0" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                  {lesson.duration}
                                </span>
                              )}
                            </div>

                            {lesson.description && (
                              <p className="text-xs line-clamp-1 truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                {lesson.description}
                              </p>
                            )}

                            {lesson.resources && lesson.resources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {lesson.resources.slice(0, 3).map((resource, i) => (
                                  <a
                                    key={i}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md3-sm text-[10px] font-medium transition-all"
                                    style={{
                                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                                      color: 'var(--md-sys-color-on-surface-variant)',
                                    }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>attach_file</span>
                                    {resource.name}
                                  </a>
                                ))}
                                {lesson.resources.length > 3 && (
                                  <span className="text-[10px]" style={{ color: 'var(--md-sys-color-outline)' }}>
                    +{lesson.resources.length - 3} مورد آخر
                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {!isLocked && (
                            <div className="flex-shrink-0 flex items-center gap-1 text-sm font-medium opacity-0 transition-all duration-300" style={{ color: lessonColor }}>
                              <span aria-hidden="true">{isCompleted ? 'مكتمل' : 'ابدأ التعلم'}</span>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                            </div>
                          )}

                          {!isLocked && (
                            <div
                              className="absolute inset-0 rounded-md3-sm pointer-events-none"
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

                    <button
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-md3-sm transition-all duration-300"
                      style={{
                        border: '2px dashed var(--md-sys-color-outline-variant)',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                      <span className="text-sm font-medium">إضافة درس جديد</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {modules.length === 0 && (
        <div
          className="text-center py-12"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '16px' }}
        >
          <div className="mb-4">
            <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--md-sys-color-outline)' }}>
              menu_book
            </span>
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>لا يوجد محتوى بعد</h3>
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>سيتم إضافة الوحدات والدروس قريباً</p>
        </div>
      )}
    </section>
  );
}

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
      <div
        className="p-3"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '12px' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>تقدم الكورس</span>
          <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{totalCompleted}/{totalLessons}</span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}dd)`,
            }}
          />
        </div>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {modules.map((module, i) => {
          const isOpen = openModule === module.id;
          const completedCount = module.lessons.filter(l => completedLessons.includes(l.id) || l.isCompleted).length;
          const progress = module.lessons.length > 0 ? Math.round((completedCount / module.lessons.length) * 100) : 0;

          return (
            <div
              key={module.id}
              className="overflow-hidden"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '12px' }}
            >
              <button
                onClick={() => setOpenModule(isOpen ? null : module.id)}
                className="w-full p-3 flex items-center gap-3 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                aria-expanded={isOpen}
              >
                <div
                  className="w-8 h-8 rounded-md3-sm flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: progress === 100
                      ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                      : isOpen
                      ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
                      : 'var(--md-sys-color-surface-container-high)',
                    color: progress === 100 || isOpen ? 'white' : 'var(--md-sys-color-on-surface)',
                  }}
                >
                  {progress === 100 ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                  ) : (
                    i + 1
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{module.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{module.lessons.length} درس</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                          : `linear-gradient(90deg, ${primaryColor}, ${primaryColor}dd)`,
                      }} />
                    </div>
                  </div>
                </div>

                <span
                  className="material-symbols-outlined transition-transform"
                  style={{
                    fontSize: '20px',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  expand_more
                </span>
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
                        className={`w-full flex items-center gap-2 p-2 rounded-md3-sm transition-all ${lesson.isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer'} ${isCompleted ? 'completed' : ''}`}
                        style={{
                          backgroundColor: isCompleted ? 'rgba(22,163,74,0.08)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md3-sm flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isCompleted ? '#16a34a' : 'var(--md-sys-color-surface-container-high)',
                          }}
                        >
                          {isCompleted ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'white' }}>check</span>
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)' }}>description</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate flex-1" style={{ color: lesson.isLocked ? 'var(--md-sys-color-on-surface-variant)' : 'var(--md-sys-color-on-surface)' }}>
                          {lesson.title}
                        </span>
                        {lesson.duration && <span className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{lesson.duration}</span>}
                        {lesson.isFree && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md3-sm"
                            style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                          >
                            مجاني
                          </span>
                        )}
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
