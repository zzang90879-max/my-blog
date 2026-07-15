/* Loads a single markdown post based on the ?post= query param and renders it. */
(function () {
  async function loadPost() {
    const container = document.getElementById("post-container");
    const params = new URLSearchParams(window.location.search);
    const filename = params.get("post");

    if (!filename) {
      container.innerHTML = '<p class="state-message">글을 찾을 수 없습니다.</p>';
      return;
    }

    try {
      const res = await fetch("posts/" + filename);
      if (!res.ok) throw new Error("post fetch failed");
      const raw = await res.text();
      const { meta, content } = MD.parseFrontMatter(raw);
      const tags = (meta.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      document.title = (meta.title || filename) + " · My Blog";

      container.innerHTML = `
        <header class="post-header">
          <span class="post-header-path">~/posts/${escapeHtml(filename)}</span>
          <h1>${escapeHtml(meta.title || filename)}</h1>
          <p class="post-meta">${escapeHtml(BlogApp.formatDate(meta.date))}</p>
          ${
            tags.length
              ? `<ul class="tag-list">${tags.map((t) => `<li class="tag">${escapeHtml(t)}</li>`).join("")}</ul>`
              : ""
          }
        </header>
        <div class="post-content">${MD.renderMarkdown(content)}</div>
      `;
    } catch (err) {
      container.innerHTML = '<p class="state-message">글을 불러오지 못했습니다. 정적 서버로 실행 중인지 확인해 주세요.</p>';
      console.error(err);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("DOMContentLoaded", loadPost);
})();
