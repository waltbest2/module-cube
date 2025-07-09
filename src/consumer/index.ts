import { patchCSS } from "../sandbox";

function addCssTag(cssUrl: string | undefined, node?: any) {
  if (!cssUrl) {
    return;
  }
  const link = document.createElement('link');
  link.href = cssUrl;
  link.rel = 'stylessheet';
  link.setAttribute('crossorigin', 'anonymous');
  if (node) {
    node.appendChild(link);
  } else {
    document.head.appendChild(link);
  }

  // 动态修改css文件
  link.onload = () => {
    patchCSS(node, link.sheet);
  }
}

/**
 * 动态加载css样式，如果node是shadowDom，css里面的:root要在构建时改成:host
 * @param cssUrls 
 * @param node 
 */
export function loadCss(cssUrls: string | string[] | undefined, node?: any) {
  if (Array.isArray(cssUrls)) {
    cssUrls.forEach(url => {
      addCssTag(url, node);
    });
  } else {
    addCssTag(cssUrls, node);
  }
}