export const openNewTabLink = (path: string) => {
  const base = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname + "/";
  window.open(base + path, "_blank");
};