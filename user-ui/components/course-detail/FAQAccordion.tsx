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

  // Filter items based on search query
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
          <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            لا توجد نتائج لـ "{searchQuery}"
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
      {/* Header */}
      <div className="text-center mb-4 md:mb-8">
        <h2 id="faq-title" className="text-2xl md:text-3xl font-extrabold mb-2 gradient-text">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}

        {/* Search */}
        {searchable && items.length > 5 && (
          <div className="mt-6 max-w-xl mx-auto">
            <div className="relative">
              <svg
                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--text-light)' }}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                placeholder="ابحث في الأسئلة الشائعة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border text-base transition-all"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
                aria-label="البحث في الأسئلة الشائعة"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="مسح البحث"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                تم العثور على {filteredItems.length} نتيجة
              </p>
            )}
          </div>
        )}
      </div>

      {/* FAQ Items */}
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
          <div className="text-center py-10 rounded-2xl glass-card animate-fade-up" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="text-5xl mb-3" aria-hidden="true">🔍</div>
            <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>لا توجد نتائج</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              لم نتمكن من العثور على أسئلة تطابق "{searchQuery}"
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              مسح البحث
            </button>
          </div>
        )}

        {items.length === 0 && !searchQuery && (
          <div className="text-center py-10 rounded-2xl glass-card animate-fade-up" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="text-5xl mb-3" aria-hidden="true">❓</div>
            <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>لا توجد أسئلة متاحة</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>سيتم إضافة الأسئلة الشائعة قريباً</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8 md:mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl glass-strong" style={{ borderColor: 'var(--glass-border)' }}>
          <span className="text-2xl" aria-hidden="true">💬</span>
          <div className="text-right">
            <p className="font-bold" style={{ color: 'var(--text)' }}>لم تجد إجابتك؟</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>فريق الدعم جاهز للمساعدة على مدار الساعة</p>
          </div>
          <button className="ml-auto px-4 py-2 rounded-xl text-sm font-bold text-white transition-all" style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          }}>
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
      className={`relative overflow-hidden rounded-2xl transition-all duration-500 animate-fade-up ${variant === 'card' ? 'glass-card' : 'glass-strong'}`}
      style={{
        animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
        borderColor: isOpen ? `${primaryColor}40` : 'var(--glass-border)',
        boxShadow: isOpen ? `var(--shadow-lg), 0 0 30px ${primaryColor}10` : 'var(--shadow-md)',
        background: variant === 'card' ? 'var(--gradient-card)' : 'var(--glass-bg-strong)',
      }}
      role="listitem"
    >
      {/* Category Badge */}
      {showCategory && item.category && (
        <div className="absolute top-4 left-4 z-10" aria-hidden="true">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider"
            style={{
              backgroundColor: `${primaryColor}15`,
              color: primaryColor,
              border: `1px solid ${primaryColor}30`,
            }}
          >
            {item.category}
          </span>
        </div>
      )}

      {/* Question Button */}
      <button
        onClick={onToggle}
        className="w-full p-5 md:p-6 flex items-start gap-4 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
      >
        {/* Question Number */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-extrabold transition-all duration-300"
          style={{
            background: isOpen
              ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              : 'var(--bg)',
            color: isOpen ? 'white' : 'var(--text-muted)',
            border: isOpen ? 'none' : '1px solid var(--border)',
          }}
          aria-hidden="true"
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
          ) : (
            index + 1
          )}
        </div>

        {/* Question Text */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg md:text-xl leading-relaxed" style={{ color: 'var(--text)' }}>
            {item.question}
          </h3>

          {/* Chevron */}
          <div className="flex-shrink-0 ml-2">
            <svg
              className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Answer Content */}
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
          <div className="p-5 md:p-6 pt-0 rounded-xl" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              {item.answer.split('\n').map((paragraph, i) => (
                <p key={i} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Helpful Buttons */}
            {showHelpful && (
              <div className="flex items-center gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>هل كانت هذه الإجابة مفيدة؟</span>
                <button
                  onClick={() => onHelpfulClick?.(item.id, 'yes')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'rgba(22,163,74,0.1)',
                    color: '#16a34a',
                    border: '1px solid rgba(22,163,74,0.2)',
                  }}
                >
                  <span aria-hidden="true">👍</span>
                  نعم ({item.helpful?.yes || 0})
                </button>
                <button
                  onClick={() => onHelpfulClick?.(item.id, 'no')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'rgba(220,38,38,0.1)',
                    color: '#dc2626',
                    border: '1px solid rgba(220,38,38,0.2)',
                  }}
                >
                  <span aria-hidden="true">👎</span>
                  لا ({item.helpful?.no || 0})
                </button>
              </div>
            )}

            {/* Related FAQs */}
            {item.category && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>أسئلة ذات صلة:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['كيف يمكنني التسجيل؟', 'ما هي طرق الدفع؟', 'هل يوجد ضمان استرداد؟'].map((q, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
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

      {/* Animated border */}
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
    <div className="rounded-xl overflow-hidden transition-all duration-300" style={{
      backgroundColor: 'var(--bg)',
      border: `1px solid ${isOpen ? `${primaryColor}40` : 'var(--border)'}`,
      boxShadow: isOpen ? `var(--shadow-md), 0 0 20px ${primaryColor}10` : 'var(--shadow-sm)',
    }}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-expanded={isOpen}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{
            background: isOpen ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` : 'var(--bg-elevated)',
            color: isOpen ? 'white' : 'var(--text-muted)',
            border: isOpen ? 'none' : '1px solid var(--border)',
          }}
        >
          {isOpen ? '−' : '+'}
        </div>
        <h4 className="font-medium text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>
          {item.question}
        </h4>
        <svg className={`flex-shrink-0 w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? contentHeight : 0 }}>
        <div ref={contentRef} className="px-3 pb-3 pr-11 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
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
      className={`w-full p-3 rounded-xl text-right transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${isOpen ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-elevated)]'}`}
      style={{ border: `1px solid ${isOpen ? `${primaryColor}40` : 'var(--border)'}` }}
      aria-expanded={isOpen}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
          style={{
            background: isOpen ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` : 'var(--bg)',
            color: isOpen ? 'white' : 'var(--text-muted)',
            border: isOpen ? 'none' : '1px solid var(--border)',
          }}
        >
          {isOpen ? '−' : '+'}
        </div>
        <span className="font-medium text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>
          {item.question}
        </span>
      </div>

      {isOpen && (
        <div className="mt-3 pr-8 text-sm animate-fade-up" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
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
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeCategory === category.id ? 'active' : ''}`}
          style={{
            backgroundColor: activeCategory === category.id ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` : 'var(--bg)',
            color: activeCategory === category.id ? 'white' : 'var(--text-secondary)',
            border: activeCategory === category.id ? 'none' : '1px solid var(--border)',
            boxShadow: activeCategory === category.id ? `0 4px 15px ${primaryColor}30` : 'var(--shadow-sm)',
          }}
          role="tab"
          aria-selected={activeCategory === category.id}
        >
          <span aria-hidden="true">{category.icon}</span>
          <span>{category.name}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
            backgroundColor: activeCategory === category.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)',
            color: activeCategory === category.id ? 'white' : 'var(--text-muted)',
          }}>
            {category.count}
          </span>
        </button>
      ))}
    </div>
  );
}