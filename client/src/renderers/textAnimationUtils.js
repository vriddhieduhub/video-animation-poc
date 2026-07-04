import React from 'react';

export function flattenNodes(children) {
  const result = [];

  const traverse = (node, inherited = { style: {}, className: '', type: null }) => {
    if (typeof node === 'string' || typeof node === 'number') {
      const text = String(node);
      for (const char of text) {
        result.push({
          char,
          style: inherited.style,
          className: inherited.className,
          type: inherited.type,
        });
      }
      return;
    }

    if (!React.isValidElement(node)) return;

    const nodeProps = node.props || {};
    const mergedStyle = { ...inherited.style, ...(nodeProps.style || {}) };
    const mergedClassName = [inherited.className, nodeProps.className].filter(Boolean).join(' ');

    React.Children.forEach(nodeProps.children, (child) => {
      traverse(child, {
        style: mergedStyle,
        className: mergedClassName,
        type: typeof node.type === 'string' ? node.type : inherited.type,
      });
    });
  };

  React.Children.forEach(children, (child) => traverse(child));
  return result;
}

export function htmlToReactNodes(html) {
  if (!html) return [];

  const template = document.createElement('template');
  template.innerHTML = html;

  function convert(node, key) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const props = {};
    if (node.getAttribute('class')) props.className = node.getAttribute('class');
    if (node.getAttribute('style')) props.style = node.getAttribute('style');

    const children = Array.from(node.childNodes)
      .map((child, index) => convert(child, `${key}-${index}`))
      .filter((child) => child !== null);

    return React.createElement(node.tagName.toLowerCase(), { key, ...props }, ...children);
  }

  return Array.from(template.content.childNodes)
    .map((child, index) => convert(child, `node-${index}`))
    .filter((child) => child !== null);
}
