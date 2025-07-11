
import { loadComponent, loadCss } from './consumer';
import { initModuleCubeWebcomponent } from './module-cube';
import { CssSandboxOption, LifeParams, ModuleType, ProviderOption, RemoteComponentOption, ServiceOption, ServiceType } from './types';
import { genRandomString, isRealObject } from './utils';

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
  return element.tagName === 'LINK' && (!element.rel || element.rel === 'stylesheet');
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
      patchCSS(node, rule, rule.conditionText);
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
 * 复制新的style
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
   * 保存当前document下所有的host节点，如果有shadowDom，就是shadowDom，否则就是module-cube节点
   */
  private moduleList: { [moduleName: string]: {host?: any; serviceName?: string }} = {};

  private readonly jsSandboxLabel = Symbol('js-sandbox');

  private mcTagName: string = 'module-cube';

  private mcTagNameUpper: string = 'MODULE-CUBE';

  /**
   * 下面开始保存各个劫持的原生方法
   */
  private rawBodyAppendChild = HTMLBodyElement.prototype.appendChild;

  private rawHeadAppendChild = HTMLHeadElement.prototype.appendChild;

  private rawElementAppendChild = Element.prototype.appendChild;

  private rawNodeAppendChild = Node.prototype.appendChild;

  private rawBodyRemoveChild = HTMLBodyElement.prototype.removeChild;

  private rawHeadRemoveChild = HTMLHeadElement.prototype.removeChild;

  private rawElementRemoveChild = Element.prototype.removeChild;

  private rawNodeRemoveChild = Node.prototype.removeChild;

  private rawElementRemove = Element.prototype.remove;

  private rawCustomElementsDefine = customElements.define;

  private rawGetComputedStyle = globalThis.getComputedStyle;

  private rawDocumentQuerySelector = document.querySelector;

  private rawDocumentQuerySelectorAll = document.querySelectorAll;

  private rawInsertAdjacentElement = Element.prototype.insertAdjacentElement;

  /**
   * 用于缓存iife加载的入口js内容，防止重复fetch
   */
  public entryIIFEJsCache = {};

  public readonly version = '@mc_version';

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

      // 防止有些微前端框架不让直接修改window下变量
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
  
  /**
   * 将样式复制到其他同类节点
   * @param service 
   * @param element 
   * @param includeHead 
   * @returns 
   */
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
      this.rawElementAppendChild.call(document.head, style);
    }
  }

  /**
   * 将link复制到其它同类节点
   * @param service 
   * @param element 
   * @returns 
   */
  private cloneLink2OtherHost(service, element) {
    const { serviceId, serviceName } = service;
    if (!element.href || !serviceId) {
      return;
    }


    for (const [id, module] of Object.entries(this.moduleList)) {
      const { host } = module;
      if (module.serviceName === serviceName && serviceId !== id && !getLinkInHost(element, host)) {
        const link = cloneLink(element);
        link.onload = () => {
          patchCSS(host, link.sheet);
        };
        this.rawElementAppendChild.call(host, link);
      }
    }
  }

  /**
   * 除了第一个执行的组件外，其他相同组件也需要添加样式
   * @param service 
   * @param element 
   * @param includeHead 
   */
  private cloneCSS2OtherHost(service, element, includeHead: boolean) {
    if (element.tagName === 'STYLE') {
      this.cloneStyle2OtherHost(service, element, includeHead);
    } else {
      this.cloneLink2OtherHost(service, element);
    }
  }

  /**
   * 校验这个样式是不是全局
   * @param service 
   * @param element 
   * @returns 
   */
  private checkGlobalCSS(service, element): boolean {
    const { serviceName } = service;
    const { globalCheck } = this.serviceList[serviceName] || {};
    if (globalCheck) {
      const host = this.getHost(service);
      return globalCheck(host, element);
    }

    return false;
  }

  /**
   * 给host添加link，同时添加到当前页面其他相同元素
   * @param service 服务信息
   * @param host 宿主节点
   * @param element link元素
   * @param checkExist 针对主动添加link的场景，如果已经存在，把自己删掉
   * @returns 
   */
  private addNewLink(service, host, element, checkExist = false) {
    const { serviceName } = service;

    //需要使用addEventListener，不能用load，否则webpack动态添加link，覆盖webpack的link.onload中的promise的resolve
    element.addEventListener('load', () => {
      if (element.href) {
        if (!this.serviceLinks[serviceName].get(element.href)) {
          const newLink = cloneLink(element);
          this.serviceLinks[serviceName].set(newLink.href, newLink);
        } else if (checkExist && getLinkInHost(element, host)) {
          // 针对主动添加link的场景，如果已经存在，把自己删除
          console.warn('[module-cube] not first time to add link');
          element.remove();
          return;
        }

        patchCSS(host, element.sheet);
        this.cloneCSS2OtherHost(service, element, false);
      } else {
        console.warn('[module-cube] no href in link. Ignore it');
      }
    });
    return this.rawElementAppendChild.call(host, element);
  }

  /**
   * 同一个组件，可能只会增加一次
   * @param service 
   * @param element 
   * @param includeHead 
   */
  private patchStyleAppend(service: ServiceType, element, includeHead: boolean) {
    const { serviceName } = service;
    if (!serviceName) {
      return;
    }

    const host = this.getHost(service);

    this.serviceStyles[serviceName] = this.serviceStyles[serviceName] || new Map<string, Node>();

    // 存在先添加style，再补充内容，监听判断，类似g6
    if (!element.textContent) {
      let styleObserver: any = new MutationObserver(() => {
        styleObserver.disconnect();
        styleObserver = null;

        // 如果已经存在，则忽略
        if ([...this.serviceStyles[serviceName].keys()].includes(element.textContent)) {
          console.warn('[module-cube] get empty or exist style! ignore it');
          try {
            this.rawElementRemoveChild.call(host, element);
          } catch (e) {
            this.rawElementRemove.call(element);
          }

          return;
        }

        patchCSS(host, element.sheet);
        const style = cloneStyle(element);
        this.serviceStyles[serviceName].set(style.textContent!, style);

        // 复制到其他service
        this.cloneCSS2OtherHost(service, element, includeHead);
      });

      styleObserver.observe(element, { childList: true });

      // 5s后如果还是为空，则清除监听和节点
      let timeout: any = setTimeout(() => {
        clearTimeout(timeout);
        timeout = null;
        // 如果5s还是为空，则该节点重复，删掉
        if (element && !element.textContent) {
          console.warn('[module-cube] get empty style after 5s! ignore it');
          try {
            this.rawElementRemoveChild.call(host, element);
          } catch (e) {
            this.rawElementRemove.call(element);
          }
          styleObserver?.disconnect();
          styleObserver = null;
        }
      }, 5000);
    }

    if (![...this.serviceStyles[serviceName].keys()].includes(element.textContent)) { 
      if (element.textContent) {
        const style = cloneStyle(element);
        this.serviceStyles[serviceName].set(style.textContent!, style);
      }

      const ele = this.rawElementAppendChild.call(host, element);
      patchCSS(host, element.sheet);
      return ele;
    } else {
      const existStyle = getStyleInHost(element.textContent, host);
      if (existStyle) {
        existStyle.remove();
      }
      const ele = this.rawElementAppendChild.call(host, element);
      patchCSS(host, element.sheet);
      return ele;
    }
  }

  /**
   * 添加link额外处理
   * @param service 
   * @param element 
   * @returns 
   */
  private patchLinkAppend(service: ServiceType, element) {
    const { serviceName } = service;
    if (!serviceName) {
      return;
    }

    const host = this.getHost(service);

    element.setAttribute('crossorigin', 'anonymous');

    this.serviceLinks[serviceName] = this.serviceLinks[serviceName] || new Map<string, Node>();
    return this.addNewLink(service, host, element, true);
  }

  /**
   * 劫持appendChild
   * 
   * rawElementAppendChild 表示 Node.prototype
   * @param point 
   * @param rawFn 
   */
  private patchElementAppendChild(point: Function, rawFn: Function) {
    const target = this;

    point.prototype.appendChild = function <T extends Node>(node: T) {
      const element = node as any;

      if (!element) {
        return rawFn.call(this, element);
      }
      if (this === document.body && element.tagName !== target.mcTagNameUpper) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        if (service) {
          const host = target.getHost(service, true);
          if (host) {
            return rawFn.call(host, element);
          }
        }
        return rawFn.call(this, element);
      }

      if (!(this instanceof HTMLHeadElement)) {
        return rawFn.call(this, element);
      }

      if (element.tagName === 'STYLE') {
        const service: ServiceType = target.check({style: element}) as ServiceType;
        if (service) {
          const isGlobal = target.checkGlobalCSS(service, element);
          const result = target.patchStyleAppend(service, element, isGlobal);
          if (result) {
            target.cloneCSS2OtherHost(service, element, isGlobal);
            return result;
          }
        }
      } else if (isStyleLink(element)) {
        const service: ServiceType = target.check({ link: element }) as ServiceType;
        if (service) {
          return target.patchLinkAppend(service, element);
        }
      }

      return rawFn.call(this, element);
    };
  }

  /**
   * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的appendChild
   */
  private patchHeadAppendChild() {
    const target = this;
    HTMLHeadElement.prototype.appendChild = function <T extends Node>(node: T) {
      const element = node as any;

      if (!element) {
        return target.rawHeadAppendChild.call(this, element);
      }

      if (element.tagName === 'STYLE') {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        if (service) {
          const isGlobal = target.checkGlobalCSS(service, element);
          const result = target.patchStyleAppend(service, element, isGlobal);
          if (result) {
            target.cloneCSS2OtherHost(service, element, isGlobal);
            return result;
          }
        }
      } else if (isStyleLink(element)) {
        const service: ServiceType = target.check({ link: element }) as ServiceType;
        if (service) {
          return target.patchLinkAppend(service, element);
        }
      }

      return target.rawHeadAppendChild.call(this, element);
    };
  }

  private patchBodyAppendChild() {
    const target = this;

    HTMLBodyElement.prototype.appendChild = function <T extends Node>(node: T) {
      const element = node as any;

      if (!element) {
        return target.rawBodyAppendChild.call(this, element);
      }

      if (element.tagName !== target.mcTagNameUpper) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        if (service) {
          const host = target.getHost(service, true);
          if (host) {
            return target.rawBodyAppendChild.call(host, element);
          }
        }
      }

      return target.rawBodyAppendChild.call(this, element);
    };
  }

  /**
   * 劫持不同层面的原型上的appendChild
   */
  private patchAppendChild() {
    if (Object.prototype.hasOwnProperty.call(HTMLHeadElement.prototype, 'appendChild')) {
      this.patchHeadAppendChild();
    }

    if (Object.prototype.hasOwnProperty.call(HTMLBodyElement.prototype, 'appendChild')) {
      this.patchBodyAppendChild();
    }

    if (Object.prototype.hasOwnProperty.call(Element.prototype, 'appendChild')) {
      this.patchElementAppendChild(Element, this.rawElementAppendChild);
    }

    this.patchElementAppendChild(Node, this.rawNodeAppendChild);
  }

  /**
   * 劫持removeChild
   * @param point 
   * @param rawFn 
   */
  private patchElementRemoveChild(point: Function, rawFn: Function) {
    const target = this;

    // 支持不同微前端框架劫持不同层面
    point.prototype.removeChild = function <T extends Node>(node: T) {
      const element = node as any;
      if (!element) {
        return rawFn.call(this, element);
      }

      if (this === document.body && element.tagName !== target.mcTagNameUpper) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        if (service) {
          const host = target.getHost(service, true);
          if (host) {
            try {
              rawFn.call(host, element);
            } catch (e) {
              console.warn('[module-cube] host does not have child elment, remove from document.body, element is', element);
            }
          }
        }

        return rawFn.call(this, element);
      }

      if (!(this instanceof HTMLHeadElement)) {
        return rawFn.call(this, element);
      }

      if (element.tagName === 'STYLE' && element.textContent) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        const { serviceName } = service || {};
        const ele = target.serviceStyles[serviceName!]?.get(element.textContent);
        if (ele) {
          target.serviceStyles[serviceName!].delete(element.textContent);
        }

        if (service) {
          return rawFn.call(target.getHost(service), element);
        }
      } else if (isStyleLink(element)) {
        const service: ServiceType = target.check({ link: element }) as ServiceType;
        const { serviceName } = service || {};
        const ele = target.serviceLinks[serviceName!]?.get(element.href);
        if (ele) {
          target.serviceLinks[serviceName!].delete(element.href);
        }

        if (service) {
          return rawFn.call(target.getHost(service), element);
        }
      }

      return rawFn.call(this, element);
    };
  }

  /**
   * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的removeChild
   */
  private patchHeadRemoveChild() {
    const target = this;
    HTMLHeadElement.prototype.removeChild = function <T extends Node>(node: T) {
      const element = node as any;
      if (!element) {
        return target.rawHeadRemoveChild.call(this, element);
      }

      if (element.tagName === 'STYLE' && element.textContent) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        const { serviceName } = service || {};
        const ele = target.serviceStyles[serviceName!]?.get(element.textContent);
        if (ele) {
          target.serviceStyles[serviceName!].delete(element.textContent);
        }

        if (service) {
          return target.rawHeadRemoveChild.call(target.getHost(service), element);
        }
      } else if (isStyleLink(element)) {
        const service: ServiceType = target.check({ link: element }) as ServiceType;
        const { serviceName } = service || {};
        const ele = target.serviceLinks[serviceName!]?.get(element.href);
        if (ele) {
          target.serviceLinks[serviceName!].delete(element.href);
        }

        if (service) {
          return target.rawHeadRemoveChild.call(target.getHost(service), element);
        }
      }

      return target.rawHeadRemoveChild.call(this, element);
    }
  }

  /**
   * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的removeChild
   */
  private patchBodyRemoveChild() {
    const target = this;

    HTMLBodyElement.prototype.removeChild = function <T extends Node>(node: T) {
      const element = node as any;
      if (!element) {
        return target.rawBodyRemoveChild.call(this, element);
      }

      if (element.tagName !== target.mcTagNameUpper) {
        const service: ServiceType = target.check({ style: element }) as ServiceType;
        if (service) {
          const host = target.getHost(service, true);
          if (host) {
            // 防止host的子不是element
            try {
              target.rawBodyRemoveChild.call(host, element);
            } catch (e) {
              console.warn('[module-cube] host does not have child, remove from document.body, element is', element);
            }
          }
        }
      }

      return target.rawBodyRemoveChild.call(this, element);
    }
  }

  /**
   * 劫持不同层面的原型上的removeChild
   */
  private patchRemoveChild() {
    if (Object.prototype.hasOwnProperty.call(HTMLHeadElement.prototype, 'removeChild')) {
      this.patchHeadRemoveChild();
    }

    if (Object.prototype.hasOwnProperty.call(HTMLBodyElement.prototype, 'removeChild')) {
      this.patchBodyRemoveChild();
    }

    if (Object.prototype.hasOwnProperty.call(Element.prototype, 'removeChild')) {
      this.patchElementRemoveChild(Element, this.rawElementRemoveChild);
    }

    // 即使劫持head和body，也要考虑Node的劫持
    this.patchElementRemoveChild(Node, this.rawNodeRemoveChild);
  }

  /**
   * 动态删除style的时候，需要清理缓存的styles，下次可以自动添加
   */
  private patchElementRemove() {
    const target = this;

    Element.prototype.remove = function() {
      if (this.tagName !== 'STYLE') {
        return target.rawElementRemove.call(this);
      }

      const service: ServiceType = target.check({ style: this }) as ServiceType;
      const { serviceName } = service || {};
      const ele = target.serviceStyles[serviceName!]?.get(this.textContent);
      if (ele) {
        target.serviceStyles[serviceName!].delete(this.textContent);
      }

      // 额外添加到head的style，要及时清理
      const { _headStyles } = this;
      while (_headStyles?.length) {
        const style = _headStyles.pop();
        target.rawElementRemove.call(style);
      }

      return target.rawElementRemove.call(this);
    };
  }

  /**
   * 劫持querySelector，如果是在子服务中，则优先在shadowdom中找，找不到去document中找
   */
  private patchDocumentQuerySelector() {
    const target = this;

    document.querySelector = function(selector: string) {
      if (!isInnerSelector(selector)) {
        return target.rawDocumentQuerySelector.call(this, selector);
      }

      const service: ServiceType = target.check() as ServiceType;
      if (service) {
        const host = target.getHost(service);
        if (host) {
          if (selector === HOST_SELECTOR) {
            return host.host || host;
          }

          return host.querySelector(selector) || target.rawDocumentQuerySelector.call(this, selector);
        }
      }

      return target.rawDocumentQuerySelector.call(this, selector);
    };

    document.querySelectorAll = function(selector: string) {
      if (!isInnerSelector(selector)) {
        return target.rawDocumentQuerySelectorAll.call(this, selector);
      }

      const service: ServiceType = target.check() as ServiceType;
      if (service) {
        const host = target.getHost(service);
        if (host) {
          return host.querySelectorAll(selector) || target.rawDocumentQuerySelectorAll.call(this, selector);
        }
      }

      return target.rawDocumentQuerySelectorAll.call(this, selector);
    };
  }

  /**
   * 劫持原生customElement.define
   * 
   * 仿照Zone.js的劫持
   */
  private patchCustomElementDefine() {
    const target = this;

    globalThis.customElements.define = function (name: string, opts: { prototype: { connectedCallback?: Function }}, options?: any) {
      if (opts?.prototype) {
        const prototype = opts.prototype;
        try {
          if (prototype.connectedCallback) {
            prototype.connectedCallback = wrapCustomElementFn('connectedCallback', prototype.connectedCallback);
          }
        } catch (e) {
          console.warn('[module-cube] patch connectedCallback failed ', e.message);
        }
      }

      return target.rawCustomElementsDefine.call(globalThis.customElements, name, opts, options);
    }
  }

  /**
   * getComputedStyle(shadowRoot) 会报错，仿照处理下
   */
  private patchGetComputedStyle() {
    const target = this;

    globalThis.getComputedStyle = function (element, pseudoElt) {
      if (isShadowDomType(element)) {
        return {};
      }

      return target.rawGetComputedStyle.call(this, element, pseudoElt);
    }
  }

  /**
   * 检查该接口是不是在module-cube的shadowDom中，并返回shadowDom
   * @param element 
   */
  private getShadowWhenInModuleCube(element: any) {
    if (isShadowDomType(element.parentNode) && element.parentNode.host.tagName === this.mcTagNameUpper) {
      return element.parentNode;
    }

    return null;
  }

  /**
   * 为了适配vite开发态，Style.insertAdjacentElement劫持处理
   */
  private patchInsertAdjacentElement() {
    const target = this;

    Element.prototype.insertAdjacentElement = function (position, element: any) {
      const ret = target.rawInsertAdjacentElement.call(this, position, element);

      if (this.tagName === 'STYLE' && element.tagName === 'STYLE' && position === 'afterend') {
        const host = target.getShadowWhenInModuleCube(this);

        if (!host) {
          return ret; 
        }

        patchCSS(host, element.sheet);
        const serviceName = host.host.getAttribute('servicename');
        const serviceId = host.host.getAttribute('id');
        const style = cloneStyle(element);
        target.serviceStyles[serviceName].set(style.textContent!, style);

        // 复制到其他service
        target.cloneCSS2OtherHost({ serviceId, serviceName }, element, false);
      }

      return ret;
    };
  }

  /**
   * 整体patch
   */
  private patch() {
    if (!this.needPatched) {
      console.warn('[module-cube] needPatch is false, no need to patch');
      return;
    }

    if (this.alreadyPatched) {
      console.warn('[module-cube] already patched');
      return;
    }

    this.patchAppendChild();
    this.patchRemoveChild();
    this.patchElementRemove();

    this.patchCustomElementDefine();
    this.patchGetComputedStyle();
    this.patchDocumentQuerySelector();
    this.patchInsertAdjacentElement();

    this.alreadyPatched = true;
  }

  /**
   * 取消patch
   */
  public unpatch() {
    if(!this.needPatched) {
      console.warn('[module-cube] needPatched is false, no need to unpatch');
      return;
    }

    Element.prototype.appendChild = this.rawElementAppendChild;
    Node.prototype.removeChild = Element.prototype.removeChild = this.rawElementRemoveChild;
    Element.prototype.remove = this.rawElementRemove;
    globalThis.customElements.define = this.rawCustomElementsDefine;
    globalThis.getComputedStyle = this.rawGetComputedStyle;
    document.querySelector = this.rawDocumentQuerySelector;
    document.querySelectorAll = this.rawDocumentQuerySelectorAll;
    Element.prototype.insertAdjacentElement = this.rawInsertAdjacentElement;
    this.alreadyPatched = false;
  }

  private appendExistStylesAndLinks(serviceName: string, host: any) {
    const styles = this.serviceStyles[serviceName];

    styles?.forEach((ele: any) => {
      if (!getStyleInHost(ele.textContent, host)) {
        const style = cloneStyle(ele);
        this.rawElementAppendChild.call(host, style);
        patchCSS(host, style.sheet);
      }
    });

    const links = this.serviceLinks[serviceName];

    links?.forEach((ele: any) => {
      if (!getLinkInHost(ele, host)) {
        const link = cloneLink(ele);
        this.addNewLink({ serviceName }, host, link);
      }
    });
  }

  private addExtraCSS(host, cssContent) {
    if (!cssContent) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = cssContent;
    host.appendChild(style);
  }

  /**
   * 清理zone
   * @param id 
   */
  public clearZoneByNodeId(id: string) {
    this.zoneList[id] = undefined;
    delete this.zoneList[id];
  }

  /**
   * 创建并获取module-cube这个webcomponent dom元素
   * @param id 根据父元素生成的id
   * @param options 
   * @returns 
   */
  private createModuleCubeDom(id: string, options: RemoteComponentOption) {
    const { serviceName, mcAttributes, jsSandboxProps } = options || {};
    let container;
    if (customElements.get(this.mcTagName)) {
      container = document.createElement(this.mcTagName);
    } else {
      container = document.createElement('div');
    }

    if (isRealObject(mcAttributes)) {
      for (const [key, value] of Object.entries(mcAttributes!)) {
        container.setAttribute(key, value);
      }
    }

    container.setAttribute('servicename', serviceName);
    container.setAttribute('v', this.version);
    container.setAttribute('id', id);

    container.jsSandboxProps = jsSandboxProps;

    return container;
  }

  /**
   * 创建并获取module-cube下的shadowDom,如果不需要返回module-cube
   * @param needShadowDom 服务配置是否需要shadowDom
   * @param container module-cube容器
   * @returns shadowRoot或module-cube
   */
  private getShadowDom(needShadowDom, container) {
    let subHost;
    if (this.needShadowDom && needShadowDom !== false) {
      const shadowRoot = container.attachShadow({ mode: 'open'});
      subHost = shadowRoot;
    } else {
      subHost = container;
    }

    return subHost;
  }

  /**
   * 在body添加全局div
   * @param serviceName 
   * @param options 
   * @returns 
   */
  private addGlobalDiv(serviceName: string, options: RemoteComponentOption): void {
    const { useGlobalDivSandbox, needShadowDom } = this.serviceList[serviceName] || {};
    if (!useGlobalDivSandbox) {
      return;
    }

    const globalId = genGlobalDivId(serviceName);

    if (this.moduleList[globalId]?.host) {
      return;
    }

    const container = this.createModuleCubeDom(globalId, options);
    const subHost = this.getShadowDom(needShadowDom, container);

    document.body.appendChild(container);

    const { extraCss, loaderOption } = options || {};
    this.addExtraCSS(subHost, extraCss);

    const { css } = loaderOption || {};
    loadCss(css, subHost);
  }

  /**
   * 根据加载组件的父节点获取id
   * @param hostNode 父节点
   * @param options 服务名和id
   * @returns 
   */
  private getParentId(hostNode, options: RemoteComponentOption) {
    const { serviceName, mcAttributes } = options;
    let id = mcAttributes?.id;
    if (!id) {
      const pId = hostNode.getAttribute('id');
      if (pId) {
        id = `${ID_PREFIX}_${pId}`;
      } else {
        id = genId(serviceName);
      }
    }

    return id;
  }

  /**
   * 加载组件失败，需要清理组件，globalDiv先不清理，因为是共用的
   * @param container 
   */
  private clearModuleCube(container) {
    if (container) {
      container.remove();
    }
  }

  /**
   * 把shadowDom host加入到参数中
   * @param providerConfig 
   * @param subHost 
   * @returns 
   */
  private addHost2Params(providerConfig: ProviderOption, subHost) {
    if (!providerConfig) {
      return;
    }

    const { params } = providerConfig;
    if (Array.isArray(params)) {
      params.push(subHost);
    } else {
      providerConfig.params = [params, subHost];
    }
  }

  /**
   * 在zone里运行一些生命周期钩子回调
   * @param hook 
   * @param params 
   * @returns 
   */
  private runLifeHooks(hook: (params: LifeParams) => any, params: LifeParams): any {
    if (!hook) {
      return undefined;
    }

    const { zone } = params;
    let ret;
    if (zone) {
      zone.run(() => {
        ret = hook({...params});
      });
    } else {
      ret = hook({...params});
    }

    return ret;
  }

  /**
   * 不是用模块联邦，立即执行函数，直接加载，为了能确定运行zone
   * 
   * js只需要加载一次，不需要多次加载。
   * @param id 
   * @param entry 
   * @param host 
   * @returns 
   */
  private async loadIifeInZone(id: string, entry: string, host = document.body) {
    const caches = this.entryIIFEJsCache;
    if (caches[entry]) {
      return caches[entry].promise;
    }

    try {
      const script = document.createElement('script');
      script.type = 'module';
      if (!globalThis._CSSSandbox.zoneList[id]) {
        script.setAttribute('crossorigin', 'anonymous');
        script.src = entry;
        script.onload = () => {
          globalThis._CSSSandbox.entryIIFEJsCache[entry].r(1);
        };
        script.onerror = () => {
          globalThis._CSSSandbox.entryIIFEJsCache[entry].r(1);
        };
      } else {
        const content = await fetch(entry).then(t => {
          if (t.status >= 400) {
            throw new Error('[module-cube] call iife error');
          } else {
            return t.text();
          }
        });

        // module模式下必须代码内部创建zone。外部创建zone只能在非module下生效
        script.textContent = `globalThis._CSSSandbox.zoneList['${id}].run(() => {
  ${content};
   lobalThis._CSSSandbox.entryIIFEJsCache['${entry}'].r(1);
});
//# sourceURL=${entry}
`;

      }

      // iife增加执行完成的通知事件
      caches[entry] = {};
      caches[entry].promise = new Promise(r => {
        caches[entry].r = r;
      });

      let myHost = host;
      if (myHost instanceof HTMLHeadElement) {
        myHost = document.body;
      }
      myHost.appendChild(script);

      // 不在dom呈现script
      if (globalThis._CSSSandbox.zoneList[id]) {
        script.remove();
      }
      return caches[entry].promise;
    } catch (e) {
      console.error('[module-cube] load iife script error ', e.message);
      return Promise.resolve(1);
    }

  }

  /**
   * 用create的默认方式生成webcomponent组件
   * @param zone 
   * @param wcTagName 
   * @returns 
   */
  private defaultGenWebComponent(zone, wcTagName) {
    let wc;
    if (zone) {
      zone.run(() => {
        wc = document.createElement(wcTagName);
        wc.zone = zone;
      });
    } else {
      wc = document.createElement(wcTagName);
    }

    return wc;
  }

  /**
   * 在zone中执行
   * @param id 
   * @param serviceName 
   * @param options 
   * @returns 
   */
  private runInZone(id: string, serviceName: string, options: RemoteComponentOption): Promise<any & { unmount: Function}> {
    const { jsSandboxProps, lifecycle, loaderOption } = options;
    const { type = 'module', entryUrl, cssHost, css } = loaderOption || {};
    const { beforeLoadComponent } = lifecycle || {};

    return new Promise(r => {
      if (globalThis.Zone && this.needPatched) {
        let zone = this.zoneList[id];
        if (!zone) {
          zone = globalThis.Zone.current.fork({
            name: id,
            properties: {
              [ZoneLabel]: true,
              serviceName,
            }
          });
          this.zoneList[id] = zone;
        }

        if (!entryUrl) {
          r(undefined);
          return;
        }

        this.runLifeHooks(beforeLoadComponent!, { zone } as any);
        this.isolateWindowJS(jsSandboxProps!);
        if (type === ModuleType.IIFE) {
          this.loadIifeInZone(id, entryUrl, cssHost).finally(() => {
            loadCss(css, cssHost);
            r(undefined);
          });
        } else {
          zone.run(() => {
            r(loadRemoteComponent(options));
          });
        }
      } else {
        console.warn('[module-cube] no zone.js or no needPatched. run in root');
        r(loadRemoteComponent(options));
      }
    });
  }

  public addModule(id: string, serviceName: string, host: any) {
    this.moduleList[id] = {
      serviceName,
      host,
    }
  }

  /**
   * 清除缓存的模块host信息
   * @param id dom的id
   * @param shadowRoot module-cube下的shadowRoot，如果存在则校验，防止重复id替换了之前的shadowRoot 
   * @returns 
   */
  public clearModuleByNodeId(id: string, shadowRoot?: ShadowRoot) {
    if (!this.moduleList[id]) {
      return;
    }

    if (shadowRoot && this.moduleList[id].host !== shadowRoot) {
      return;
    }

    this.moduleList[id].host = undefined;
    delete this.moduleList[id].host;
    delete this.moduleList[id].serviceName;
    (this.moduleList[id] as any) = undefined;
    delete this.moduleList[id];
  }

  /**
   * 做一些收尾处理，主要针对webcomponent组件本身的dom操作
   * @param param0 
   * @param options 
   */
  private afterRun({ module, zone, host}, options: RemoteComponentOption) {
    const { wcTagName, wcParams, lifecycle } = options;
    const { beforeGenWC, genWC, beforeAppendWC, afterAppendWC } = lifecycle || {};
    let wc: any;

    this.runLifeHooks(beforeGenWC!, { module, zone, host, wcTagName });

    try {
      wc = this.runLifeHooks(genWC!, { module, zone, host, wcTagName });
      if (!wc) {
        wc = this.defaultGenWebComponent(zone, wcTagName);
      }
    } catch (e) {
      console.warn('[module-cube] genWC exception', e.message);
      wc = this.defaultGenWebComponent(zone, wcTagName);
    }

    // 把当前的host传递给组件，方便组件查找内部的子元素
    wc.mcHost = host;

    addParams2Node(wc, wcParams);
    this.runLifeHooks(beforeAppendWC!, { module, zone, host, wcTagName, wc });
    host.appendChild(wc);
    this.runLifeHooks(afterAppendWC!, { module, zone, host, wcTagName, wc });
    
  }

  public async load(hostNode: any, options: RemoteComponentOption) : Promise<{
    module: any & {unmount: Function} & {exception: Error}; host: any; zone: any 
  }> {
    const { serviceName, extraCss } = options;
    const { needShadowDom } = this.serviceList[serviceName] || {};

    // 根据加载组件的父节点获取id
    const id = this.getParentId(hostNode, options);

    // 如果配置全局div，则在body下添加module-cube，必须比原始组件先创建
    this.addGlobalDiv(serviceName, options);

    // 创建并获取module-cube这个webcomponent dom元素
    const container = this.createModuleCubeDom(id, options);

    // 创建并获取module-cube下的shadowDom，如果不需要返回module-cube
    const subHost = this.getShadowDom(needShadowDom, container);

    // 必须等shadowDom创建后再添加到hostNode，否则启动module-cube找不到shadowDom
    hostNode.appendChild(container);

    // 做一些存量样式处理
    options.loaderOption.cssHost = subHost;
    this.appendExistStylesAndLinks(serviceName, subHost);
    this.addExtraCSS(subHost, extraCss);

    // 刷新传递给webcomponent的参数，新增shadowDom
    this.addHost2Params(options.loaderOption.providerConfig!, subHost);

    // 调用远端逻辑
    const module = await this.runInZone(id, serviceName, options);

    if (module?.exception) {
      this.clearModuleCube(container);

      return {
        module,
        zone: null,
        host: null,
      }
    }

    const zone = this.zoneList[id];
    const retObj = {
      module,
      zone,
      host: subHost,
    }

    this.afterRun(retObj, options);
    return retObj;
  }



  private isDefineBySandbox(prop): boolean {
    if (!Object.prototype.hasOwnProperty.call(globalThis, prop)) {
      return false;
    }

    const { get, configurable, writable } = Object.getOwnPropertyDescriptor(globalThis, prop) as PropertyDescriptor;
    if ((get as any)?.from === this.jsSandboxLabel || configurable === false || writable === false) {
      return true;
    }

    return false;
  }

  /**
   * 一定的window变量隔离能力，但是没法监听delete操作
   * 
   * 不支持delete window.prop
   * @param props 
   * @returns 
   */
  private isolateWindowJS(props: {prop: string; needClear?: boolean}[]) {
    if (!props?.length) {
      return;
    }

    for (const { prop } of props) {
      // 如果已经沙箱定义，或者外部定义不让修改，就不重新定义
      if (this.isDefineBySandbox(prop)) {
        continue;
      }

      // 记录之前的值到global,便于后面使用
      globalThis._JSSandbox.__mcGlobal[prop] = globalThis[prop];

      const getFn: any = () => {
        const { serviceName } = getServiceIdByCurrentZone() || {};
        if (serviceName) {
          globalThis._JSSandbox[serviceName] = globalThis._JSSandbox[serviceName] || {};
          return globalThis._JSSandbox[serviceName][prop];
        } else {
          return globalThis._JSSandbox.__mcGlobal[prop];
        }
      };

      getFn.from = this.jsSandboxLabel;

      const setFn = v => {
        const { serviceName } = getServiceIdByCurrentZone() || {};
        if (serviceName) {
          globalThis._JSSandbox[serviceName] = globalThis._JSSandbox[serviceName] || {};
          globalThis._JSSandbox[serviceName][prop] = v;
        } else {
          globalThis._JSSandbox.__mcGlobal[prop] = v;
        }

        return true;
      };

      Object.defineProperty(globalThis, prop, {
        set: setFn,
        get: getFn,
      })
    }
  }
}