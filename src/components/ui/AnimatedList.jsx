import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useInView } from "motion/react";
import "./AnimatedList.css";

// AnimatedList (React Bits, adapted for Linkloop). Each row scales + fades in as
// it scrolls into view and back out as it leaves, with top/bottom fade overlays
// and optional keyboard navigation. Generalised beyond the original string-only
// demo: pass `renderItem(item, index, selected)` to render rich rows (e.g. chat
// rows with avatars/badges); falls back to a plain text row otherwise.
const AnimatedItem = ({ children, delay = 0, index, spacing, onMouseEnter, onClick }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5, triggerOnce: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
      style={{ marginBottom: spacing, cursor: "pointer" }}
    >
      {children}
    </motion.div>
  );
};

export function AnimatedList({
  items = [],
  renderItem,
  getKey,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = "",
  itemClassName = "",
  displayScrollbar = true,
  initialSelectedIndex = -1,
  gradientColor = "#0b1426",
  itemSpacing = 8,
}) {
  const listRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const handleItemMouseEnter = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback(
    (item, index) => {
      setSelectedIndex(index);
      if (onItemSelect) onItemSelect(item, index);
    },
    [onItemSelect],
  );

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(
      scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1),
    );
  }, []);

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          if (onItemSelect) onItemSelect(items[selectedIndex], selectedIndex);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const selectedItem = container.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
      } else if (
        itemBottom >
        containerScrollTop + containerHeight - extraMargin
      ) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: "smooth",
        });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div
      className={`al-container ${className}`}
      style={{ "--al-gradient": gradientColor }}
    >
      <div
        ref={listRef}
        className={`al-list ${!displayScrollbar ? "al-no-scrollbar" : ""}`}
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={getKey ? getKey(item, index) : index}
            delay={0.1}
            index={index}
            spacing={itemSpacing}
            onMouseEnter={() => handleItemMouseEnter(index)}
            onClick={() => handleItemClick(item, index)}
          >
            {renderItem ? (
              renderItem(item, index, selectedIndex === index)
            ) : (
              <div
                className={`al-item ${itemClassName}`}
                style={{ color: "inherit" }}
              >
                <p className="al-item-text">{item}</p>
              </div>
            )}
          </AnimatedItem>
        ))}
      </div>
      {showGradients && (
        <>
          <div className="al-top-gradient" style={{ opacity: topGradientOpacity }} />
          <div
            className="al-bottom-gradient"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      )}
    </div>
  );
}

export default AnimatedList;
