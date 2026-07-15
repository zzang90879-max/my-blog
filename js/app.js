/* Shared helpers used on every page. */
(function () {
  window.BlogApp = {
    formatDate(value) {
      if (!value) return "";
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    },
  };
})();
