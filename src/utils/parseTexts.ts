import { convert } from "html-to-text";
import LinkifyIt from "linkify-it";

export function parseHtmlToText(text: string) {
  return convert(text, {
    wordwrap: false,
    selectors: [
      { selector: "a", format: "inline" },
      { selector: "img", format: "skip" },
    ],
  });
}

interface createParams {
  schema: string;
  url: string;
  text: string;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function createLinkTag({ schema, url, text }: createParams) {
  const safeUrl = escapeHtml(url);
  const safeText = escapeHtml(text);

  if (schema.includes("mailto")) {
    return `<a href="${safeUrl}">${safeText}</a>`;
  }

  return `<a href="${safeUrl}" target="_blank" rel="noreferrer nofollow">${safeText}</a>`;
}

export function linkifyText(textToParse: string) {
  const linkify = new LinkifyIt();

  let result = textToParse.replace(/>([^<]+)</g, (match, content) => {
    const matches = linkify.match(content);

    if (!matches) return match;

    const processedText = matches.reduce(
      (updatedText, { url, text, schema }) => {
        const linkTag = createLinkTag({ schema, url, text });
        return updatedText.replace(text, linkTag);
      },
      content,
    );

    return `>${processedText}<`;
  });

  if (!/<[^>]+>/.test(textToParse)) {
    const matches = linkify.match(result);

    if (matches) {
      matches.forEach(({ url, text, schema }) => {
        const linkTag = createLinkTag({ schema, url, text });
        result = result.replace(text, linkTag);
      });
    }
  }

  return result;
}

export function sanitizeLinks(text: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");

    const tagWhiteList = ["a", "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "ul", "ol", "li", "br", "span", "div"];
    const attributeWhiteList = ["href", "class", "style", "rel", "target"];

    // Remove all tags not in the whitelist
    doc.body.querySelectorAll("*").forEach((node) => {
        if (!tagWhiteList.includes(node.tagName.toLowerCase())) {
            node.remove();
        }

        // Strip attributes not in the whitelist
        Array.from(node.attributes).forEach((attr) => {
            if (!attributeWhiteList.includes(attr.name)) {
                node.removeAttribute(attr.name);
            }
        });
    });

    doc.querySelectorAll("a").forEach((link) => {

        const href = link.getAttribute("href") ?? "";

        if (href.includes("javascript")) {
            // There is no legitimate reason to have javascript: links
            // Delete the link entirely
            link.replaceWith(document.createTextNode(""));
        } else {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noreferrer nofollow");
        }

    });

    return doc.body.innerHTML;
}
