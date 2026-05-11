export function getMainScrollElement() {
  return document.getElementById("main-scroll-container") ??
    document.documentElement;
}

export function scrollPageToTop() {
  const scrollElement = getMainScrollElement();
  scrollElement.scrollTo({ top: 0 });
}
