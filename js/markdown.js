/* Minimal markdown parser: front matter + common block/inline syntax. */
(function () {
  function parseFrontMatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) {
      return { meta: {}, content: raw };
    }
    const meta = {};
    match[1].split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      meta[key] = value;
    });
    return { meta, content: raw.slice(match[0].length) };
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }

  function renderMarkdown(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let listType = null;
    let inCode = false;
    let codeLang = "";
    let codeBuf = [];
    let paraBuf = [];

    function flushPara() {
      if (paraBuf.length) {
        out.push("<p>" + renderInline(paraBuf.join(" ")) + "</p>");
        paraBuf = [];
      }
    }

    function closeList() {
      if (listType) {
        out.push(listType === "ul" ? "</ul>" : "</ol>");
        listType = null;
      }
    }

    while (i < lines.length) {
      const line = lines[i];

      if (inCode) {
        if (/^```/.test(line)) {
          out.push(
            '<pre><code class="language-' +
              codeLang +
              '">' +
              escapeHtml(codeBuf.join("\n")) +
              "</code></pre>"
          );
          codeBuf = [];
          inCode = false;
        } else {
          codeBuf.push(line);
        }
        i++;
        continue;
      }

      if (/^```/.test(line)) {
        flushPara();
        closeList();
        inCode = true;
        codeLang = line.slice(3).trim();
        i++;
        continue;
      }

      if (/^\s*$/.test(line)) {
        flushPara();
        closeList();
        i++;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushPara();
        closeList();
        const level = heading[1].length;
        out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushPara();
        closeList();
        out.push("<hr>");
        i++;
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushPara();
        closeList();
        const buf = [quote[1]];
        i++;
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        out.push("<blockquote><p>" + renderInline(buf.join(" ")) + "</p></blockquote>");
        continue;
      }

      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      const ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        const type = ul ? "ul" : "ol";
        if (listType !== type) {
          closeList();
          out.push(type === "ul" ? "<ul>" : "<ol>");
          listType = type;
        }
        out.push("<li>" + renderInline(ul ? ul[1] : ol[1]) + "</li>");
        i++;
        continue;
      }

      closeList();
      paraBuf.push(line.trim());
      i++;
    }

    flushPara();
    closeList();
    return out.join("\n");
  }

  window.MD = { parseFrontMatter, renderMarkdown };
})();
