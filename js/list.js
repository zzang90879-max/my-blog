/* Loads posts/posts.json, fetches each post's front matter, and renders the list. */
(function () {
  async function loadPosts() {
    const listEl = document.getElementById("post-list");
    try {
      const manifestRes = await fetch("posts/posts.json");
      if (!manifestRes.ok) throw new Error("posts.json fetch failed");
      const filenames = await manifestRes.json();

      const posts = await Promise.all(
        filenames.map(async (filename) => {
          const res = await fetch("posts/" + filename);
          if (!res.ok) return null;
          const raw = await res.text();
          const { meta } = MD.parseFrontMatter(raw);
          return {
            filename,
            title: meta.title || filename,
            date: meta.date || "",
            excerpt: meta.excerpt || "",
            tags: (meta.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          };
        })
      );

      const valid = posts.filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1));

      if (valid.length === 0) {
        listEl.innerHTML = '<p class="state-message">아직 작성된 글이 없습니다.</p>';
        return;
      }

      listEl.innerHTML = valid
        .map(
          (post) => `
        <li class="post-card">
          <div class="post-card-titlebar">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="post-card-path">~/posts/${escapeHtml(post.filename)}</span>
          </div>
          <div class="post-card-body">
            <h2 class="post-card-title">
              <a href="post.html?post=${encodeURIComponent(post.filename)}">${escapeHtml(post.title)}</a>
            </h2>
            <p class="post-meta">${escapeHtml(BlogApp.formatDate(post.date))}</p>
            ${post.excerpt ? `<p class="post-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
            ${
              post.tags.length
                ? `<ul class="tag-list">${post.tags.map((t) => `<li class="tag">${escapeHtml(t)}</li>`).join("")}</ul>`
                : ""
            }
          </div>
        </li>`
        )
        .join("");
    } catch (err) {
      listEl.innerHTML = '<p class="state-message">글 목록을 불러오지 못했습니다. 정적 서버로 실행 중인지 확인해 주세요.</p>';
      console.error(err);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("DOMContentLoaded", loadPosts);
})();
