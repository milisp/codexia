import { useEffect, useState } from 'react';
import { useLocaleStore } from '@/stores/settings/useLocaleStore';
import { useSettingsStore } from '@/stores/settings/useSettingsStore';

interface Quote {
  content: string;
  author: string;
}

interface QuotesData {
  [category: string]: Quote[];
}

export function useRandomQuote(trigger?: any) {
  const { locale } = useLocaleStore();
  const { enabledQuoteCategories } = useSettingsStore();
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      const isZh = locale === 'zh';
      const fileName = isZh ? 'quotes-zh.json' : 'quotes.json';

      try {
        const response = await fetch(`/${fileName}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data: QuotesData = await response.json();

        // Filter categories based on enabledQuoteCategories
        const activeCategories = Object.keys(data).filter((cat) =>
          enabledQuoteCategories.includes(cat)
        );

        // Flatten only enabled quotes
        const filteredQuotes: Quote[] = activeCategories.flatMap((cat) => data[cat]);

        if (filteredQuotes.length > 0) {
          const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
          setQuote(filteredQuotes[randomIndex]);
        } else if (Object.keys(data).length > 0) {
          // Fallback to all quotes if all categories are disabled
          const allQuotes: Quote[] = Object.values(data).flat();
          const randomIndex = Math.floor(Math.random() * allQuotes.length);
          setQuote(allQuotes[randomIndex]);
        }
      } catch (error) {
        console.error('Failed to fetch quote:', error);
      }
    };

    fetchQuote();
  }, [locale, trigger, enabledQuoteCategories]);

  return quote;
}
