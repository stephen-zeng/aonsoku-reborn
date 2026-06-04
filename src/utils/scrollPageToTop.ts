export function getPageScrollElement() {
  return document.scrollingElement ?? document.documentElement;
}

export function getPageScrollMetrics() {
  const element = getPageScrollElement();
  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };
}

export function scrollPageToTop() {
  window.scrollTo({ top: 0 });
}

export function addPageScrollListener(
  listener: (this: Window, ev: Event) => void,
  options?: boolean | AddEventListenerOptions,
) {
  window.addEventListener("scroll", listener, options);
  return () => window.removeEventListener("scroll", listener, options);
}
