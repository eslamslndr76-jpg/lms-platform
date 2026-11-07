'use client';

import { useState, useRef, useEffect } from 'react';
import { useBranding } from '../BrandingProvider';

interface FAQItem {
  id: string | number;
  question: string;
  answer: string;
  category?: string;
  helpful?: { yes: number; no: number };
}

interface FAQAccordionProps {
  items: FAQItem[];
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'compact' | 'card' | 'sidebar';
  defaultOpen?: (string | number)[];
  showCategory?: boolean;
  showHelpful?: boolean;
  onHelpfulClick?: (faqId: string | number, vote: 'yes' | 'no') => void;
  className?: string;
  searchable?: boolean;
}

export function FAQAccordion({
  items,
  title = 'الأسئلة الشائعة',
  subtitle,
  variant = 'default',
  defaultOpen = [],
  showCategory = true,
  showHelpful = false,
  onHelpfulClick,
  className = '',
  searchable = true,
}: FAQAccordionProps) {
  const { primaryColor, secondaryColor } = useBranding();
  const [openItems, setOpenItems] = useState<(string | number)[]>(defaultOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase().trim();
      setFilteredItems(
        items.filter(item =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, items]);

  const toggleItem = (id: string | number) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const isOpen = (id: string | number) => openItems.includes(id);

  if (variant === 'compact') {
    return (
      <div className={`space-y-2 ${className}`} role="region" aria-label={title}>
        {filteredItems.map((item) => (
          <CompactFAQItem
            key={item.id}
            item={item}
            isOpen={isOpen(item.id)}
            onToggle={() => toggleItem(item.id)}
            primaryColor={primaryColor}
            showHelpful={showHelpful}
            onHelpfulClick={onHelpfulClick}
          />
        ))}
        {searchable && filteredItems.length === 0 && searchQuery && (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            لا توجد نتائج لـ &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`space-y-1 max-h-[500px] overflow-y-auto pr-1 ${className}`} role="region" aria-label={title}>
        {filteredItems.map((item) => (
          <SidebarFAQItem
            key={item.id}
            item={item}
            isOpen={isOpen(item.id)}
            onToggle={() => toggleItem(item.id)}
            primaryColor={primaryColor}
          />
        ))}
      </div>
    );
  }

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="faq-title">
      <div className="text-center mb-4 md:mb-8">
        <h2 id="faq-title" className="text-2xl md:text-3xl font-extrabold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {subtitle}
          </p>
        )}

        {searchable && items.length > 5 && (
          <div className="mt-6 max-w-xl mx-auto">
            <div className="relative">
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined"
                style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '1.25rem' }}
                aria-hidden="true"
              >
                search
              </span>
              <input
                ref={searchRef}
                type="search"
                placeholder="ابحث في الأسئلة الشائعة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-full border text-base transition-all bg-[var(--md-sys-color-surface-container-low)]"
                style={{
                  borderColor: 'var(--md-sys-color-outline)',
                  color: 'var(--md-sys-color-on-surface)',
                }}
                aria-label="البحث في الأسئلة الشائعة"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                  aria-label="مسح البحث"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>close</span>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                تم العثور على {filteredItems.length} نتيجة
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3" role="list">
        {filteredItems.map((item, index) => (
          <FAQItemComponent
            key={item.id}
            item={item}
            index={index}
            isOpen={isOpen(item.id)}
            onToggle={() => toggleItem(item.id)}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            showCategory={showCategory}
            showHelpful={showHelpful}
            onHelpfulClick={onHelpfulClick}
            variant={variant}
          />
        ))}

        {searchable && filteredItems.length === 0 && searchQuery && (
          <div className="text-center py-10 rounded-md3-md bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] animate-fade-up">
            <span className="material-symbols-outlined mb-3 block" style={{ fontSize: '3rem', color: 'var(--md-sys-color-on-surface-variant)' }} aria-hidden="true">search_off</span>
            <h3 className="font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>لا توجد نتائج</h3>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              لم نتمكن من العثور على أسئلة تطابق &quot;{searchQuery}&quot;
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 rounded-full text-sm font-medium transition-all bg-[var(--md-sys-color-primary)]"
              style={{ color: 'var(--md-sys-color-on-primary)' }}
            >
              مسح البحث
            </button>
          </div>
        )}

        {items.length === 0 && !searchQuery && (
          <div className="text-center py-10 rounded-md3-md bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] animate-fade-up">
            <span className="material-symbols-outlined mb-3 block" style={{ fontSize: '3rem', color: 'var(--md-sys-color-on-surface-variant)' }} aria-hidden="true">help</span>
            <h3 className="font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>لا توجد أسئلة متاحة</h3>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>سيتم إضافة الأسئلة الشائعة قريباً</p>
          </div>
        )}
      </div>

      <div className="mt-8 md:mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-md3-md bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--md-sys-color-primary)' }} aria-hidden="true">comment</span>
          <div className="text-right">
            <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>لم تجد إجابتك؟</p>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>فريق الدعم جاهز للمساعدة على مدار الساعة</p>
          </div>
          <button className="ml-auto px-4 py-2 rounded-full text-sm font-bold transition-all bg-[var(--md-sys-color-primary)]" style={{ color: 'var(--md-sys-color-on-primary)' }}>
            تواصل معنا
          </button>
        </div>
      </div>
    </section>
  );
}

interface FAQItemComponentProps {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  primaryColor: string;
  secondaryColor: string;
  showCategory: boolean;
  showHelpful: boolean;
  onHelpfulClick?: (faqId: string | number, vote: 'yes' | 'no') => void;
  variant: 'default' | 'card';
}

function FAQItemComponent({
  item,
  index,
  isOpen,
  onToggle,
  primaryColor,
  secondaryColor,
  showCategory,
  showHelpful,
  onHelpfulClick,
  variant,
}: FAQItemComponentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [isOpen]);

  return (
    <article
      className={`relative overflow-hidden rounded-md3-md transition-all duration-500 animate-fade-up bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]`}
      style={{
        animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
        borderColor: isOpen ? 'var(--md-sys-color-primary)' : undefined,
        boxShadow: isOpen ? 'var(--shadow-lg)' : 'var(--shadow-md)',
      }}
      role="listitem"
    >
      {showCategory && item.category && (
        <div className="absolute top-4 left-4 z-10" aria-hidden="true">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider"
            style={{
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              color: 'var(--md-sys-color-on-secondary-container)',
            }}
          >
            {item.category}
          </span>
        </div>
      )}

      <button
        onClick={onToggle}
        className="w-full p-5 md:p-6 flex items-start gap-4 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--md-sys-color-surface-container)]"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-md3-md flex items-center justify-center text-lg font-extrabold transition-all duration-300"
          style={{
            backgroundColor: isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
            color: isOpen ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
          }}
          aria-hidden="true"
        >
          {isOpen ? (
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>check</span>
          ) : (
            index + 1
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg md:text-xl leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            {item.question}
          </h3>
        </div>

        <div className="flex-shrink-0 ml-2">
          <span
            className="material-symbols-outlined transition-transform duration-300"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--md-sys-color-on-surface-variant)',
              fontSize: '1.5rem',
            }}
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>
      </button>

      <div
        id={`faq-answer-${item.id}`}
        className="overflow-hidden transition-all duration-500 ease-expo"
        style={{
          maxHeight: isOpen ? contentHeight : 0,
          opacity: isOpen ? 1 : 0,
          padding: isOpen ? '0 6px 6px 6px' : '0 6px',
        }}
        role="region"
        aria-label={`إجابة: ${item.question}`}
      >
        <div ref={contentRef} className="prose prose-ar max-w-none">
          <div className="p-5 md:p-6 pt-0 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
            <div style={{ color: 'var(--md-sys-color-on-surface-variant)', lineHeight: '1.8' }}>
              {item.answer.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>

            {showHelpful && (
              <div className="flex items-center gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>هل كانت هذه الإجابة مفيدة؟</span>
                <button
                  onClick={() => onHelpfulClick?.(item.id, 'yes')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }} aria-hidden="true">thumb_up</span>
                  نعم ({item.helpful?.yes || 0})
                </button>
                <button
                  onClick={() => onHelpfulClick?.(item.id, 'no')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'var(--md-sys-color-secondary-container)',
                    color: 'var(--md-sys-color-on-secondary-container)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }} aria-hidden="true">thumb_down</span>
                  لا ({item.helpful?.no || 0})
                </button>
              </div>
            )}

            {item.category && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أسئلة ذات صلة:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['كيف يمكنني التسجيل؟', 'ما هي طرق الدفع؟', 'هل يوجد ضمان استرداد؟'].map((q, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[var(--md-sys-color-surface-container-high)]"
                      style={{
                        color: 'var(--md-sys-color-on-surface)',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 right-0 bottom-0 w-1 transition-all duration-500"
        style={{
          background: isOpen
            ? `linear-gradient(180deg, ${primaryColor}, ${secondaryColor})`
            : 'transparent',
          opacity: isOpen ? 1 : 0,
        }}
        aria-hidden="true"
      />
    </article>
  );
}

/* Compact FAQ Item */
interface CompactFAQItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  primaryColor: string;
  showHelpful: boolean;
  onHelpfulClick?: (faqId: string | number, vote: 'yes' | 'no') => void;
}

function CompactFAQItem({
  item,
  isOpen,
  onToggle,
  primaryColor,
  showHelpful,
  onHelpfulClick,
}: CompactFAQItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [isOpen]);

  return (
    <div className="rounded-md3-md overflow-hidden transition-all duration-300 bg-[var(--md-sys-color-surface-container)]" style={{
      border: `1px solid ${isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
    }}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
        aria-expanded={isOpen}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-md3-md flex items-center justify-center text-sm font-bold"
          style={{
            backgroundColor: isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
            color: isOpen ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {isOpen ? (
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>remove</span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
          )}
        </div>
        <h4 className="font-medium text-sm flex-1 truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          {item.question}
        </h4>
        <span
          className="material-symbols-outlined flex-shrink-0 transition-transform"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--md-sys-color-on-surface-variant)',
            fontSize: '1.25rem',
          }}
        >
          expand_more
        </span>
      </button>

      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? contentHeight : 0 }}>
        <div ref={contentRef} className="px-3 pb-3 pr-11 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)', lineHeight: '1.7' }}>
          {item.answer}
        </div>
      </div>
    </div>
  );
}

/* Sidebar FAQ Item */
interface SidebarFAQItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  primaryColor: string;
}

function SidebarFAQItem({ item, isOpen, onToggle, primaryColor }: SidebarFAQItemProps) {
  return (
    <button
      onClick={onToggle}
      className={`w-full p-3 rounded-md3-md text-right transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container)]`}
      style={{ border: `1px solid ${isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}` }}
      aria-expanded={isOpen}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md3-md flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: isOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
            color: isOpen ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {isOpen ? (
            <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>remove</span>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>add</span>
          )}
        </div>
        <span className="font-medium text-sm flex-1 truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          {item.question}
        </span>
      </div>

      {isOpen && (
        <div className="mt-3 pr-8 text-sm animate-fade-up" style={{ color: 'var(--md-sys-color-on-surface-variant)', lineHeight: '1.7' }}>
          {item.answer}
        </div>
      )}
    </button>
  );
}

/* FAQ Categories */
interface FAQCategoriesProps {
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    count: number;
  }>;
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  className?: string;
}

export function FAQCategories({
  categories,
  activeCategory,
  onCategoryChange,
  className = '',
}: FAQCategoriesProps) {
  const { primaryColor } = useBranding();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="tablist" aria-label="تصنيفات الأسئلة">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeCategory === category.id ? 'active' : ''}`}
          style={{
            backgroundColor: activeCategory === category.id ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container)',
            color: activeCategory === category.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
            border: activeCategory === category.id ? 'none' : '1px solid var(--md-sys-color-outline-variant)',
          }}
          role="tab"
          aria-selected={activeCategory === category.id}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }} aria-hidden="true">{category.icon}</span>
          <span>{category.name}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
            backgroundColor: activeCategory === category.id ? 'rgba(255,255,255,0.2)' : 'var(--md-sys-color-surface-container-high)',
            color: activeCategory === category.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
          }}>
            {category.count}
          </span>
        </button>
      ))}
    </div>
  );
}
