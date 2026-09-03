import { ArrowUp } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';

export default function ScrollToTop({
  targetRef,
}: {
  targetRef?: RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = targetRef?.current;
    const scrollSource: HTMLElement | Window = target || window;
    const updateVisibility = () => {
      const distance = target ? target.scrollTop : window.scrollY;
      setVisible(distance > 420);
    };
    scrollSource.addEventListener('scroll', updateVisibility, {
      passive: true,
    });
    return () => scrollSource.removeEventListener('scroll', updateVisibility);
  }, [targetRef]);

  const scrollToTop = () => {
    if (targetRef?.current) {
      targetRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      className={`scroll-to-top ${visible ? 'scroll-to-top-visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title="Back to top"
    >
      <ArrowUp size={18} />
      <span>Top</span>
    </button>
  );
}
