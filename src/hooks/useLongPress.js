import { useRef, useCallback } from 'react';

/**
 * Hook for supporting press-and-hold (long-press) interaction on both desktop mouse
 * and mobile touch devices without conflicting with normal scrolling or ordinary taps.
 *
 * @param {Function} onLongPress Callback triggered after holding for threshold ms.
 * @param {Object} options Configuration options: threshold (ms), moveTolerance (px), onClick.
 */
export function useLongPress(onLongPress, options = {}) {
  const { threshold = 450, moveTolerance = 10, onClick } = options;

  const timerRef = useRef(null);
  const startCoordsRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);
  const isPressingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(
    (clientX, clientY) => {
      clearTimer();
      isLongPressTriggeredRef.current = false;
      isPressingRef.current = true;
      startCoordsRef.current = { x: clientX, y: clientY };

      timerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        isPressingRef.current = false;
        if (typeof onLongPress === 'function') {
          onLongPress();
        }
      }, threshold);
    },
    [clearTimer, onLongPress, threshold]
  );

  const handleMove = useCallback(
    (clientX, clientY) => {
      if (!isPressingRef.current) return;
      const dx = Math.abs(clientX - startCoordsRef.current.x);
      const dy = Math.abs(clientY - startCoordsRef.current.y);

      // If user moved more than tolerance, they are scrolling or dragging: cancel immediately!
      if (dx > moveTolerance || dy > moveTolerance) {
        clearTimer();
        isPressingRef.current = false;
      }
    },
    [clearTimer, moveTolerance]
  );

  const endPress = useCallback(
    (e) => {
      clearTimer();
      isPressingRef.current = false;

      // If it wasn't a long press, trigger normal click if provided
      if (!isLongPressTriggeredRef.current && typeof onClick === 'function') {
        onClick(e);
      }
    },
    [clearTimer, onClick]
  );

  // Desktop Mouse Handlers
  const onMouseDown = useCallback(
    (e) => {
      // Only trigger on primary left click
      if (e.button !== 0) return;
      startPress(e.clientX, e.clientY);
    },
    [startPress]
  );

  const onMouseMove = useCallback(
    (e) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const onMouseUp = useCallback(
    (e) => {
      endPress(e);
    },
    [endPress]
  );

  const onMouseLeave = useCallback(() => {
    clearTimer();
    isPressingRef.current = false;
  }, [clearTimer]);

  // Mobile Touch Handlers
  const onTouchStart = useCallback(
    (e) => {
      if (e.touches && e.touches.length === 1) {
        startPress(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [startPress]
  );

  const onTouchMove = useCallback(
    (e) => {
      if (e.touches && e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(
    (e) => {
      endPress(e);
    },
    [endPress]
  );

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
