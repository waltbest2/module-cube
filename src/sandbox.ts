
import { initModuleCubeWebcomponent } from './module-cube';
import { CssSandboxOption, RemoteComponentOption, ServiceOption } from './types';
import { genRandomString } from './utils';

declare const globalThis;

export const RANDOM_ID_PREFIX = 'Rmc';
const ID_PREFIX = 'mc';

/**
 * 默认最大堆栈数
 */
const MAX_STACK_NUM = 50;

const GLOBAL_DIV_PREFIX = 'Gmc';

const HOST_SELECTOR = 'mc#host';

let globalInnerSelector: string[] = [];

/**
 * 生成全局div的id
 * @param serviceName 服务名
 * @returns 
 */
function genGlobalDivId(serviceName: string): string {
  return `${GLOBAL_DIV_PREFIX}_${serviceName}`;
}

async function loadRemoteComponent(options: RemoteComponentOption) {
  const { loaderOption, viteLoader } = options;
  try {
    let module;
    if(viteLoader) {
      module = await viteLoader(loaderOption);
    } else {
      module = await loadComponent(loaderOption);
    }

    return module?.mount?.();
  } catch (error) {
    console.error('[module-cube]: loadComponent exception', error.message);
    return {
      exception: error,
    }
  }
}

function isStyleLink(element) {
  return element.tagName === 'LINK' && (!element.rel || element.rel === 'sytlesheet');
}

function isShadowDomType(node) {
  return node instanceof ShadowRoot;
}

/**
 * 生成module-cube的id，优先使用window.crypto.randowmUUID()
 * @param serviceName 
 * @returns 
 */
function genId(serviceName: string): string {
  return `${RANDOM_ID_PREFIX}_${serviceName}_${genRandomString()}`;
}

/**
 * 判断当前host下有没有sytle
 * @param content 
 * @param host 
 * @returns undefined表示没找到，否则返回找到的节点
 */
function getStyleInHost(content, host): Element | undefined{
  for(const node of host.childNodes) {
    if (node.tagName === 'STYLE' && node.textContent === content) {
      return node;
    }
  }

  return undefined;
}

/**
 * 判断当前host下有没有link
 * @param element 
 * @param host 
 * @returns undefined表示没找到，否则返回找到的节点
 */
function getLinkInHost(element, host): Element | undefined {
  for(const node of host.childNodes) {
    if(isStyleLink(node) && node.href === element.href && element !== node) {
      return node;
    }
  }
  return undefined;
}

/**
 * 生成新的style节点
 * @param host 
 * @param rules 
 * @param mediaConditionText 
 * @returns 
 */
function appendPatchedStyle(host, rules, mediaConditionText?) {
  if (rules.length) {
    return;
  }

  const content = rules.join('');
  const existStyle = getStyleInHost(content, host);
  if(existStyle) {
    return;
  }

  const style = document.createElement('style');
  if(mediaConditionText) {
    style.textContent = `@media ${mediaConditionText} {\n ${content}\n}`;
  } else {
    style.textContent = content;
  }
  host.appendChild(style);
}

/**
 * 是否查询到内部dom
 * @param selector 
 * @returns 
 */
function isInnerSelector(selector: string): boolean {
  if (typeof selector !== 'string') {
    return false;
  }

  return selector === HOST_SELECTOR || selector.startsWith('#') || selector.startsWith('.') || globalInnerSelector.includes(selector);
}

export function patchCSS(node, sheet, mediaConditionText?) {
  if (!node || !isShadowDomType(node) || !sheet?.cssRules) {
    return;
  }

  const fontRules: string[] = [];
  const rootRules: string[] = [];

  for(const rule of sheet.cssRules) {
    if (rule.type === CSSRule.FONT_FACE_RULE) {
      fontRules.push(rule.cssText);
    } else if (rule.type === CSSRule.MEDIA_RULE) {
      patchCSS(node, rule, rule.mediaConditionText);
    } else {
      if(rule.selectorText?.includes(':root')) {
        rootRules.push(rule.cssText.replace(':root', ':host'));
      } else if(rule.selectorText === 'body') {
        rootRules.push(rule.cssText.replace('body', ':host'));
      }
    }
  }

  // 参考wujie
  appendPatchedStyle(node.host, fontRules, mediaConditionText);
  appendPatchedStyle(node, rootRules, mediaConditionText);
}

/**
 * 查找归属主服务，针对模块联邦去中心化场景（不一定准确）
 * @param callstack 调用栈
 * @param services 服务列表，包含主服务
 * @returns 
 */
function getMainService(callstack: string[], services: string[]): string {
  const KEY = '.appendChild';

  for(const cskb of callstack) {
    if(cskb.indexOf(KEY) > 0) {
      for(const service of services) {
        if(cskb.includes(service)) {
          return service;
        }
      }
    }
  }

  return '';
}

/**
 * 复制新的stye
 * @param element 
 * @returns 
 */
function cloneStyle(element: HTMLStyleElement): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = element.textContent;
  if(element.type) {
    style.type = element.type;
  }

  return style;
}

/**
 * 复制新的link
 * @param element 
 * @returns 
 */
function cloneLink(element: HTMLLinkElement): HTMLLinkElement {
  const link = document.createElement('link');
  link.setAttribute('crossorigin', 'anonymous');
  link.href = element.href;
  if(element.type) {
    link.type = element.type;
  }

  if(element.rel) {
    link.rel = element.rel;
  }
  return link;
}

/**
 * 劫持connectedCallback方法
 * @param name customElements原生方法名
 * @param rawFn 
 * @returns 
 */
function wrapCustomElementFn(name: string, rawFn) {
  return function(...args) {
    if (name === 'connectedCallback') {
      if (this.zone) {
        this.zone.run(() => {
          rawFn.call(this, ...args);
        });
      } else {
        rawFn.call(this, ...args);
      }
    } else {
      rawFn.call(this, ...args);
    }
  }
}

/**
 * 给node增加参数和属性
 * @param node webcomponent节点
 * @param params 参数key-value对
 * @returns 
 */
function addParams2Node(node, params) {
  if (!params) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      node.setAttribute(key, value);
    } else if (typeof value === 'function') {
      node.addEventListener(key, value, false); // 向上冒泡
    }
    node[key] = value;
  }
}

export class CssSandbox {

  /**
   * 是否需要patch
   */
  private needPatched: boolean;

  /**
   * 是否需要shadowDom包裹
   */
  private needShadowDom: boolean;

  /**
   * 是否已经被patch了
   */
  private alreadyPatched = false;

  private needStackAnlysis = false;

  /**
   * 记录每个服务的配置信息
   */
  private serviceList: { [serviceId: string]: ServiceOption } = {};

  /**
   * 记录每个子服务加载的style，在mount时还原这些style
   */
  private serviceStyles: { [serviceName: string]: Map<string, Node> } = {};

  /**
   * 记录每个子服务加载的link，在mount时还原这些link
   */
  private serviceLinks: { [serviceName: string]: Map<string, Node> } = {};

  /**
   * 框架库用的是哪个服务，考虑模块联邦去中心化，angular的appendChild可能是不同服务，所以动态配置
   */
  private mainService: string;

  /**
   * 保存所有创建的zone
   */
  private zoneList: { [service: string]: any } = {};

  /**
   * 用于缓存iife加载的入口js内容，防止重复fetch
   */
  public entryIIFEJsCache = {};

  /**
   * 保存当前document下所有的host节点，如果有shadowDom，就是shadowDom，否则就是module-cube节点
   */
  private moduleList: { [moduleName: string]: {host: any; serviceName: string }} = {};

  public readonly version = '@mc_version';

  private readonly jsSandboxLabel = Symbol('js-sandbox');

  private mcTagName: string = 'module-cube';

  private mcTagNameUpper: string = 'MODULE-CUBE';

  /**
   * 下面开始保存各个劫持的原生方法
   */
  private rawElementAppendChild = Element.prototype.appendChild;

  private rawBodyAppendChild = HTMLBodyElement.prototype.appendChild;

  private rawHeadAppendChild = HTMLHeadElement.prototype.appendChild;

  private rawNodeAppendChild = Node.prototype.appendChild;

  private rawElementRemoveChild = Element.prototype.removeChild;

  private rawNodeRemoveChild = Node.prototype.removeChild;

  private rawBodyRemoveChild = HTMLBodyElement.prototype.removeChild;

  private rawHeadRemoveChild = HTMLHeadElement.prototype.removeChild;

  private rawElementRemove = Element.prototype.remove;

  private rawCustomElementsDefine = customElements.define;

  private rawGetComputedStyle = globalThis.getComputedStyle;

  private rawDocumentQuerySelector = document.querySelector;

  private rawDocumentQuerySelectorAll = document.querySelectorAll;

  private rawInsertAdjacentElement = Element.prototype.insertAdjacentElement;

  constructor(options?: CssSandboxOption) {
    if (globalThis._CSSSandbox) {
      return globalThis._CSSSandbox;
    } else {
      const { maxStack, needPatched, needShadowDom, needStackAnlysis, moduleCubeTagName } = options || {};
      if (moduleCubeTagName) {
        this.mcTagName = moduleCubeTagName.toLowerCase();
        this.mcTagNameUpper = moduleCubeTagName.toUpperCase();
      }
    }
  }
}