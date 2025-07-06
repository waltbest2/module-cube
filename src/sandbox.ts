
import { initModuleCubeWebcomponent } from './module-cube';
import { CssSandboxOption, RemoteComponentOption, ServiceOption, ServiceType } from './types';
import { genRandomString } from './utils';

declare const globalThis;
declare const Error;

export const RANDOM_ID_PREFIX = 'Rmc';

const ZoneLabel = 'isServiceZone';
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

/**
 * 从当前zone向上赵第一个满足条件的zone
 * @returns 
 */
function getServiceIdByCurrentZone(): ServiceType | undefined {
  if (!globalThis.Zone) {
    return undefined;
  }

  let cz = globalThis.Zone.current;
  while (cz && cz._properties?.[ZoneLabel] !== true) {
    cz = cz.parent;
  }

  if (cz) {
    return {
      serviceId: cz.name,
      serviceName: cz._properties.serviceName,
    }
  } else {
    return undefined;
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

      initModuleCubeWebcomponent(this.mcTagName);

      if (Error.stackTraceLimit) {
        if (maxStack) {
          Error.stackTraceLimit = maxStack;
        } else {
          Error.stackTraceLimit = MAX_STACK_NUM;
        }
      }

      this.mainService = '';
      this.needShadowDom = needShadowDom ?? true;
      this.needPatched = needPatched ?? true;
      this.needStackAnlysis = needStackAnlysis ?? false;
      if (this.needPatched) {
        this.patch();
      }

      globalThis.__proto__._CSSSandbox = this;
      globalThis.__proto__._JSSandbox = {
        __mcGlobal: {},
      }
    }
  }

  /**
   * 根据服务判断是否需要根据stack分析
   * @param service 
   * @returns 空字符串表示没有匹配到
   */
  private checkServiceStackConfig(service: string): string {
    const { needStackAnlysis } = this.serviceList[service] || {};
    if ( needStackAnlysis === false) {
      return '';
    }

    return service;
  }

  /**
   * 从调用栈获取相关服务
   * @param callstack 
   * @param services 
   * @returns 
   */
  private getListFromErrorStack(callstack: string[], services: string[]): string {
    // 第一次 找到对应的共享服务
    if (!this.mainService) {
      this.mainService = getMainService(callstack, services);
    }

    for (const cskb of callstack) {
      for (const service of services) {
        if (service !== this.mainService && cskb.includes(service)) {
          return this.checkServiceStackConfig(service);
        }
      }
    }

    return this.checkServiceStackConfig(this.mainService);
  }

  private check(element?: {style?: Node; link?: Node}): ServiceType | undefined {
    // check 1: 使用style 自带标识判断
    const services = Object.keys(this.serviceList);
    for (const service of services) {
      const { checkService } = this.serviceList[service] || {};
      if (element && checkService?.(element)) {
        return {
          serviceName: service
        }
      }
    }

    // check 2: 借助zone.js判断
    if (globalThis.Zone) {
      const service = getServiceIdByCurrentZone();
      if (service) {
        return service;
      }
    } else {
      console.warn('[module-cube]: no zone.js, please install zone.js, this time use error stack!')
    }

    if (!this.needStackAnlysis) {
      return undefined;
    }

    // check 3: 兜底， 使用调用栈， 模块联邦共享模式或webpack external或systemjs共享模式下，不能识别出来
    const callstack = new Error().stack.split('\n');
    const stackService = this.getListFromErrorStack(
      callstack.map((url: string) => {
        return url.substring(url.indexOf('//'));
      }),
      services
    );

    return stackService ? {
      serviceName: stackService
    } : undefined;
  }

  /**
   * 补充子服务配置信息，支持重复执行，后面设置会覆盖前面设置
   * @param service 重要：一定是静态url上的服务名
   * @param option 
   */
  public addService(service: string, option?: ServiceOption) {
    this.serviceList[service] = this.serviceList[service] || {
      needShadowDom: true,
      needStackAnlysis: true,
    };

    Object.assign(this.serviceList[service], option || {});

    this.serviceStyles[service] = this.serviceStyles[service] || new Map<string, Node>();

    this.serviceLinks[service] = this.serviceLinks[service] || new Map<string, Node>();

    const { innerSelectors } = option || {};
    if (Array.isArray(innerSelectors)) {
      globalInnerSelector = [...new Set([...globalInnerSelector, ...innerSelectors])];
    }
  }

  /**
   * 获取对应的module-cube
   * @param service id或服务名，如果是服务名，默认第一个
   * @param checkGlobal 是否需要在global中查找
   * @returns 对应某个module-cube
   */
  public getHost(service, checkGlobal = false) {
    const { serviceId, serviceName } = service;

    // 检查是否需要放到body下的全局div中
    if (checkGlobal) {
      const { useGlobalDivSandbox } = this.serviceList[serviceName] || {};
      if (useGlobalDivSandbox) {
        const globalId = genGlobalDivId(serviceName);
        if (this.moduleList[globalId]?.host) {
          return this.moduleList[globalId].host;
        }
      }
    }

    if (this.moduleList[serviceId]) {
      return this.moduleList[serviceId].host;
    } else {
      /**
       * 出现这个分支场景：
       * 1. 命中服务名，并不能确定是哪个节点或zone，类似通过style的di或调用栈
       * 2. webcomponent注册是记录的serviceid和当前serviceid不一致，但前俄面不页面并没有注册时的节点，保持当前页所有相同组件的样式一致
       */
      for (const [key, value] of Object.entries(this.moduleList)) {
        // globalDiv 不能作为组件样式承载容器
        if (value?.serviceName === serviceName && !key.startsWith(GLOBAL_DIV_PREFIX)) {
          return value.host;
        }
      }
    }

    return document.head;
  }
  
  private cloneStyle2OtherHost(service, element, includeHead: boolean) {
    const { serviceId, serviceName } = service;

    // 没有style名内容就不复制，没意义
    if (!element.textContent) {
      return;
    }

    for (const [id, module] of Object.entries(this.moduleList)) {
      // 如果没有指定serviceId, 并且不是globalDiv,则默认第一个已经被加入style
      if (!serviceId && module.serviceName === serviceName && !id.startsWith(GLOBAL_DIV_PREFIX)) {
        continue;
      }

      const { host } = module;
      if (module.serviceName === serviceName && serviceId !== id && !getStyleInHost(element.textContent, host)) {
        const style = cloneStyle(element);
        this.rawElementAppendChild.call(host, style);
        patchCSS(host, style.sheet);
      }
    }

    if (includeHead) {
      const style = cloneStyle(element);

      // 记录额外添加到head的style，需要动态清除
      element._headStyles = element._headStyles || [];
      element._headStyles.push(style);
      this.rawElementAppendChild.call(document.ATTRIBUTE_NODE, style);
    }
  }




}