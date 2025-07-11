"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CssSandbox = exports.patchCSS = exports.RANDOM_ID_PREFIX = void 0;
const consumer_1 = require("./consumer");
const module_cube_1 = require("./module-cube");
const types_1 = require("./types");
const utils_1 = require("./utils");
exports.RANDOM_ID_PREFIX = 'Rmc';
const ZoneLabel = 'isServiceZone';
const ID_PREFIX = 'mc';
/**
 * 默认最大堆栈数
 */
const MAX_STACK_NUM = 50;
const GLOBAL_DIV_PREFIX = 'Gmc';
const HOST_SELECTOR = 'mc#host';
let globalInnerSelector = [];
/**
 * 生成全局div的id
 * @param serviceName 服务名
 * @returns
 */
function genGlobalDivId(serviceName) {
    return `${GLOBAL_DIV_PREFIX}_${serviceName}`;
}
async function loadRemoteComponent(options) {
    const { loaderOption, viteLoader } = options;
    try {
        let module;
        if (viteLoader) {
            module = await viteLoader(loaderOption);
        }
        else {
            module = await (0, consumer_1.loadComponent)(loaderOption);
        }
        return module?.mount?.();
    }
    catch (error) {
        console.error('[module-cube]: loadComponent exception', error.message);
        return {
            exception: error,
        };
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
function genId(serviceName) {
    return `${exports.RANDOM_ID_PREFIX}_${serviceName}_${(0, utils_1.genRandomString)()}`;
}
/**
 * 判断当前host下有没有sytle
 * @param content
 * @param host
 * @returns undefined表示没找到，否则返回找到的节点
 */
function getStyleInHost(content, host) {
    for (const node of host.childNodes) {
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
function getLinkInHost(element, host) {
    for (const node of host.childNodes) {
        if (isStyleLink(node) && node.href === element.href && element !== node) {
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
function appendPatchedStyle(host, rules, mediaConditionText) {
    if (rules.length) {
        return;
    }
    const content = rules.join('');
    const existStyle = getStyleInHost(content, host);
    if (existStyle) {
        return;
    }
    const style = document.createElement('style');
    if (mediaConditionText) {
        style.textContent = `@media ${mediaConditionText} {\n ${content}\n}`;
    }
    else {
        style.textContent = content;
    }
    host.appendChild(style);
}
/**
 * 是否查询到内部dom
 * @param selector
 * @returns
 */
function isInnerSelector(selector) {
    if (typeof selector !== 'string') {
        return false;
    }
    return selector === HOST_SELECTOR || selector.startsWith('#') || selector.startsWith('.') || globalInnerSelector.includes(selector);
}
function patchCSS(node, sheet, mediaConditionText) {
    if (!node || !isShadowDomType(node) || !sheet?.cssRules) {
        return;
    }
    const fontRules = [];
    const rootRules = [];
    for (const rule of sheet.cssRules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
            fontRules.push(rule.cssText);
        }
        else if (rule.type === CSSRule.MEDIA_RULE) {
            patchCSS(node, rule, rule.conditionText);
        }
        else {
            if (rule.selectorText?.includes(':root')) {
                rootRules.push(rule.cssText.replace(':root', ':host'));
            }
            else if (rule.selectorText === 'body') {
                rootRules.push(rule.cssText.replace('body', ':host'));
            }
        }
    }
    // 参考wujie
    appendPatchedStyle(node.host, fontRules, mediaConditionText);
    appendPatchedStyle(node, rootRules, mediaConditionText);
}
exports.patchCSS = patchCSS;
/**
 * 查找归属主服务，针对模块联邦去中心化场景（不一定准确）
 * @param callstack 调用栈
 * @param services 服务列表，包含主服务
 * @returns
 */
function getMainService(callstack, services) {
    const KEY = '.appendChild';
    for (const cskb of callstack) {
        if (cskb.indexOf(KEY) > 0) {
            for (const service of services) {
                if (cskb.includes(service)) {
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
function cloneStyle(element) {
    const style = document.createElement('style');
    style.textContent = element.textContent;
    if (element.type) {
        style.type = element.type;
    }
    return style;
}
/**
 * 复制新的link
 * @param element
 * @returns
 */
function cloneLink(element) {
    const link = document.createElement('link');
    link.setAttribute('crossorigin', 'anonymous');
    link.href = element.href;
    if (element.type) {
        link.type = element.type;
    }
    if (element.rel) {
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
function wrapCustomElementFn(name, rawFn) {
    return function (...args) {
        if (name === 'connectedCallback') {
            if (this.zone) {
                this.zone.run(() => {
                    rawFn.call(this, ...args);
                });
            }
            else {
                rawFn.call(this, ...args);
            }
        }
        else {
            rawFn.call(this, ...args);
        }
    };
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
        }
        else if (typeof value === 'function') {
            node.addEventListener(key, value, false); // 向上冒泡
        }
        node[key] = value;
    }
}
/**
 * 从当前zone向上赵第一个满足条件的zone
 * @returns
 */
function getServiceIdByCurrentZone() {
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
        };
    }
    else {
        return undefined;
    }
}
class CssSandbox {
    /**
     * 是否需要patch
     */
    needPatched;
    /**
     * 是否需要shadowDom包裹
     */
    needShadowDom;
    /**
     * 是否已经被patch了
     */
    alreadyPatched = false;
    needStackAnlysis = false;
    /**
     * 记录每个服务的配置信息
     */
    serviceList = {};
    /**
     * 记录每个子服务加载的style，在mount时还原这些style
     */
    serviceStyles = {};
    /**
     * 记录每个子服务加载的link，在mount时还原这些link
     */
    serviceLinks = {};
    /**
     * 框架库用的是哪个服务，考虑模块联邦去中心化，angular的appendChild可能是不同服务，所以动态配置
     */
    mainService;
    /**
     * 保存所有创建的zone
     */
    zoneList = {};
    /**
     * 保存当前document下所有的host节点，如果有shadowDom，就是shadowDom，否则就是module-cube节点
     */
    moduleList = {};
    jsSandboxLabel = Symbol('js-sandbox');
    mcTagName = 'module-cube';
    mcTagNameUpper = 'MODULE-CUBE';
    /**
     * 下面开始保存各个劫持的原生方法
     */
    rawBodyAppendChild = HTMLBodyElement.prototype.appendChild;
    rawHeadAppendChild = HTMLHeadElement.prototype.appendChild;
    rawElementAppendChild = Element.prototype.appendChild;
    rawNodeAppendChild = Node.prototype.appendChild;
    rawBodyRemoveChild = HTMLBodyElement.prototype.removeChild;
    rawHeadRemoveChild = HTMLHeadElement.prototype.removeChild;
    rawElementRemoveChild = Element.prototype.removeChild;
    rawNodeRemoveChild = Node.prototype.removeChild;
    rawElementRemove = Element.prototype.remove;
    rawCustomElementsDefine = customElements.define;
    rawGetComputedStyle = globalThis.getComputedStyle;
    rawDocumentQuerySelector = document.querySelector;
    rawDocumentQuerySelectorAll = document.querySelectorAll;
    rawInsertAdjacentElement = Element.prototype.insertAdjacentElement;
    /**
     * 用于缓存iife加载的入口js内容，防止重复fetch
     */
    entryIIFEJsCache = {};
    version = '@mc_version';
    constructor(options) {
        if (globalThis._CSSSandbox) {
            return globalThis._CSSSandbox;
        }
        else {
            const { maxStack, needPatched, needShadowDom, needStackAnlysis, moduleCubeTagName } = options || {};
            if (moduleCubeTagName) {
                this.mcTagName = moduleCubeTagName.toLowerCase();
                this.mcTagNameUpper = moduleCubeTagName.toUpperCase();
            }
            (0, module_cube_1.initModuleCubeWebcomponent)(this.mcTagName);
            if (Error.stackTraceLimit) {
                if (maxStack) {
                    Error.stackTraceLimit = maxStack;
                }
                else {
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
            };
        }
    }
    /**
     * 根据服务判断是否需要根据stack分析
     * @param service
     * @returns 空字符串表示没有匹配到
     */
    checkServiceStackConfig(service) {
        const { needStackAnlysis } = this.serviceList[service] || {};
        if (needStackAnlysis === false) {
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
    getListFromErrorStack(callstack, services) {
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
    check(element) {
        // check 1: 使用style 自带标识判断
        const services = Object.keys(this.serviceList);
        for (const service of services) {
            const { checkService } = this.serviceList[service] || {};
            if (element && checkService?.(element)) {
                return {
                    serviceName: service
                };
            }
        }
        // check 2: 借助zone.js判断
        if (globalThis.Zone) {
            const service = getServiceIdByCurrentZone();
            if (service) {
                return service;
            }
        }
        else {
            console.warn('[module-cube]: no zone.js, please install zone.js, this time use error stack!');
        }
        if (!this.needStackAnlysis) {
            return undefined;
        }
        // check 3: 兜底， 使用调用栈， 模块联邦共享模式或webpack external或systemjs共享模式下，不能识别出来
        const callstack = new Error().stack.split('\n');
        const stackService = this.getListFromErrorStack(callstack.map((url) => {
            return url.substring(url.indexOf('//'));
        }), services);
        return stackService ? {
            serviceName: stackService
        } : undefined;
    }
    /**
     * 补充子服务配置信息，支持重复执行，后面设置会覆盖前面设置
     * @param service 重要：一定是静态url上的服务名
     * @param option
     */
    addService(service, option) {
        this.serviceList[service] = this.serviceList[service] || {
            needShadowDom: true,
            needStackAnlysis: true,
        };
        Object.assign(this.serviceList[service], option || {});
        this.serviceStyles[service] = this.serviceStyles[service] || new Map();
        this.serviceLinks[service] = this.serviceLinks[service] || new Map();
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
    getHost(service, checkGlobal = false) {
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
        }
        else {
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
    cloneStyle2OtherHost(service, element, includeHead) {
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
    cloneLink2OtherHost(service, element) {
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
    cloneCSS2OtherHost(service, element, includeHead) {
        if (element.tagName === 'STYLE') {
            this.cloneStyle2OtherHost(service, element, includeHead);
        }
        else {
            this.cloneLink2OtherHost(service, element);
        }
    }
    /**
     * 校验这个样式是不是全局
     * @param service
     * @param element
     * @returns
     */
    checkGlobalCSS(service, element) {
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
    addNewLink(service, host, element, checkExist = false) {
        const { serviceName } = service;
        //需要使用addEventListener，不能用load，否则webpack动态添加link，覆盖webpack的link.onload中的promise的resolve
        element.addEventListener('load', () => {
            if (element.href) {
                if (!this.serviceLinks[serviceName].get(element.href)) {
                    const newLink = cloneLink(element);
                    this.serviceLinks[serviceName].set(newLink.href, newLink);
                }
                else if (checkExist && getLinkInHost(element, host)) {
                    // 针对主动添加link的场景，如果已经存在，把自己删除
                    console.warn('[module-cube] not first time to add link');
                    element.remove();
                    return;
                }
                patchCSS(host, element.sheet);
                this.cloneCSS2OtherHost(service, element, false);
            }
            else {
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
    patchStyleAppend(service, element, includeHead) {
        const { serviceName } = service;
        if (!serviceName) {
            return;
        }
        const host = this.getHost(service);
        this.serviceStyles[serviceName] = this.serviceStyles[serviceName] || new Map();
        // 存在先添加style，再补充内容，监听判断，类似g6
        if (!element.textContent) {
            let styleObserver = new MutationObserver(() => {
                styleObserver.disconnect();
                styleObserver = null;
                // 如果已经存在，则忽略
                if ([...this.serviceStyles[serviceName].keys()].includes(element.textContent)) {
                    console.warn('[module-cube] get empty or exist style! ignore it');
                    try {
                        this.rawElementRemoveChild.call(host, element);
                    }
                    catch (e) {
                        this.rawElementRemove.call(element);
                    }
                    return;
                }
                patchCSS(host, element.sheet);
                const style = cloneStyle(element);
                this.serviceStyles[serviceName].set(style.textContent, style);
                // 复制到其他service
                this.cloneCSS2OtherHost(service, element, includeHead);
            });
            styleObserver.observe(element, { childList: true });
            // 5s后如果还是为空，则清除监听和节点
            let timeout = setTimeout(() => {
                clearTimeout(timeout);
                timeout = null;
                // 如果5s还是为空，则该节点重复，删掉
                if (element && !element.textContent) {
                    console.warn('[module-cube] get empty style after 5s! ignore it');
                    try {
                        this.rawElementRemoveChild.call(host, element);
                    }
                    catch (e) {
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
                this.serviceStyles[serviceName].set(style.textContent, style);
            }
            const ele = this.rawElementAppendChild.call(host, element);
            patchCSS(host, element.sheet);
            return ele;
        }
        else {
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
    patchLinkAppend(service, element) {
        const { serviceName } = service;
        if (!serviceName) {
            return;
        }
        const host = this.getHost(service);
        element.setAttribute('crossorigin', 'anonymous');
        this.serviceLinks[serviceName] = this.serviceLinks[serviceName] || new Map();
        return this.addNewLink(service, host, element, true);
    }
    /**
     * 劫持appendChild
     *
     * rawElementAppendChild 表示 Node.prototype
     * @param point
     * @param rawFn
     */
    patchElementAppendChild(point, rawFn) {
        const target = this;
        point.prototype.appendChild = function (node) {
            const element = node;
            if (!element) {
                return rawFn.call(this, element);
            }
            if (this === document.body && element.tagName !== target.mcTagNameUpper) {
                const service = target.check({ style: element });
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
                const service = target.check({ style: element });
                if (service) {
                    const isGlobal = target.checkGlobalCSS(service, element);
                    const result = target.patchStyleAppend(service, element, isGlobal);
                    if (result) {
                        target.cloneCSS2OtherHost(service, element, isGlobal);
                        return result;
                    }
                }
            }
            else if (isStyleLink(element)) {
                const service = target.check({ link: element });
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
    patchHeadAppendChild() {
        const target = this;
        HTMLHeadElement.prototype.appendChild = function (node) {
            const element = node;
            if (!element) {
                return target.rawHeadAppendChild.call(this, element);
            }
            if (element.tagName === 'STYLE') {
                const service = target.check({ style: element });
                if (service) {
                    const isGlobal = target.checkGlobalCSS(service, element);
                    const result = target.patchStyleAppend(service, element, isGlobal);
                    if (result) {
                        target.cloneCSS2OtherHost(service, element, isGlobal);
                        return result;
                    }
                }
            }
            else if (isStyleLink(element)) {
                const service = target.check({ link: element });
                if (service) {
                    return target.patchLinkAppend(service, element);
                }
            }
            return target.rawHeadAppendChild.call(this, element);
        };
    }
    patchBodyAppendChild() {
        const target = this;
        HTMLBodyElement.prototype.appendChild = function (node) {
            const element = node;
            if (!element) {
                return target.rawBodyAppendChild.call(this, element);
            }
            if (element.tagName !== target.mcTagNameUpper) {
                const service = target.check({ style: element });
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
    patchAppendChild() {
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
    patchElementRemoveChild(point, rawFn) {
        const target = this;
        // 支持不同微前端框架劫持不同层面
        point.prototype.removeChild = function (node) {
            const element = node;
            if (!element) {
                return rawFn.call(this, element);
            }
            if (this === document.body && element.tagName !== target.mcTagNameUpper) {
                const service = target.check({ style: element });
                if (service) {
                    const host = target.getHost(service, true);
                    if (host) {
                        try {
                            rawFn.call(host, element);
                        }
                        catch (e) {
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
                const service = target.check({ style: element });
                const { serviceName } = service || {};
                const ele = target.serviceStyles[serviceName]?.get(element.textContent);
                if (ele) {
                    target.serviceStyles[serviceName].delete(element.textContent);
                }
                if (service) {
                    return rawFn.call(target.getHost(service), element);
                }
            }
            else if (isStyleLink(element)) {
                const service = target.check({ link: element });
                const { serviceName } = service || {};
                const ele = target.serviceLinks[serviceName]?.get(element.href);
                if (ele) {
                    target.serviceLinks[serviceName].delete(element.href);
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
    patchHeadRemoveChild() {
        const target = this;
        HTMLHeadElement.prototype.removeChild = function (node) {
            const element = node;
            if (!element) {
                return target.rawHeadRemoveChild.call(this, element);
            }
            if (element.tagName === 'STYLE' && element.textContent) {
                const service = target.check({ style: element });
                const { serviceName } = service || {};
                const ele = target.serviceStyles[serviceName]?.get(element.textContent);
                if (ele) {
                    target.serviceStyles[serviceName].delete(element.textContent);
                }
                if (service) {
                    return target.rawHeadRemoveChild.call(target.getHost(service), element);
                }
            }
            else if (isStyleLink(element)) {
                const service = target.check({ link: element });
                const { serviceName } = service || {};
                const ele = target.serviceLinks[serviceName]?.get(element.href);
                if (ele) {
                    target.serviceLinks[serviceName].delete(element.href);
                }
                if (service) {
                    return target.rawHeadRemoveChild.call(target.getHost(service), element);
                }
            }
            return target.rawHeadRemoveChild.call(this, element);
        };
    }
    /**
     * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的removeChild
     */
    patchBodyRemoveChild() {
        const target = this;
        HTMLBodyElement.prototype.removeChild = function (node) {
            const element = node;
            if (!element) {
                return target.rawBodyRemoveChild.call(this, element);
            }
            if (element.tagName !== target.mcTagNameUpper) {
                const service = target.check({ style: element });
                if (service) {
                    const host = target.getHost(service, true);
                    if (host) {
                        // 防止host的子不是element
                        try {
                            target.rawBodyRemoveChild.call(host, element);
                        }
                        catch (e) {
                            console.warn('[module-cube] host does not have child, remove from document.body, element is', element);
                        }
                    }
                }
            }
            return target.rawBodyRemoveChild.call(this, element);
        };
    }
    /**
     * 劫持不同层面的原型上的removeChild
     */
    patchRemoveChild() {
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
    patchElementRemove() {
        const target = this;
        Element.prototype.remove = function () {
            if (this.tagName !== 'STYLE') {
                return target.rawElementRemove.call(this);
            }
            const service = target.check({ style: this });
            const { serviceName } = service || {};
            const ele = target.serviceStyles[serviceName]?.get(this.textContent);
            if (ele) {
                target.serviceStyles[serviceName].delete(this.textContent);
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
    patchDocumentQuerySelector() {
        const target = this;
        document.querySelector = function (selector) {
            if (!isInnerSelector(selector)) {
                return target.rawDocumentQuerySelector.call(this, selector);
            }
            const service = target.check();
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
        document.querySelectorAll = function (selector) {
            if (!isInnerSelector(selector)) {
                return target.rawDocumentQuerySelectorAll.call(this, selector);
            }
            const service = target.check();
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
    patchCustomElementDefine() {
        const target = this;
        globalThis.customElements.define = function (name, opts, options) {
            if (opts?.prototype) {
                const prototype = opts.prototype;
                try {
                    if (prototype.connectedCallback) {
                        prototype.connectedCallback = wrapCustomElementFn('connectedCallback', prototype.connectedCallback);
                    }
                }
                catch (e) {
                    console.warn('[module-cube] patch connectedCallback failed ', e.message);
                }
            }
            return target.rawCustomElementsDefine.call(globalThis.customElements, name, opts, options);
        };
    }
    /**
     * getComputedStyle(shadowRoot) 会报错，仿照处理下
     */
    patchGetComputedStyle() {
        const target = this;
        globalThis.getComputedStyle = function (element, pseudoElt) {
            if (isShadowDomType(element)) {
                return {};
            }
            return target.rawGetComputedStyle.call(this, element, pseudoElt);
        };
    }
    /**
     * 检查该接口是不是在module-cube的shadowDom中，并返回shadowDom
     * @param element
     */
    getShadowWhenInModuleCube(element) {
        if (isShadowDomType(element.parentNode) && element.parentNode.host.tagName === this.mcTagNameUpper) {
            return element.parentNode;
        }
        return null;
    }
    /**
     * 为了适配vite开发态，Style.insertAdjacentElement劫持处理
     */
    patchInsertAdjacentElement() {
        const target = this;
        Element.prototype.insertAdjacentElement = function (position, element) {
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
                target.serviceStyles[serviceName].set(style.textContent, style);
                // 复制到其他service
                target.cloneCSS2OtherHost({ serviceId, serviceName }, element, false);
            }
            return ret;
        };
    }
    /**
     * 整体patch
     */
    patch() {
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
    unpatch() {
        if (!this.needPatched) {
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
    appendExistStylesAndLinks(serviceName, host) {
        const styles = this.serviceStyles[serviceName];
        styles?.forEach((ele) => {
            if (!getStyleInHost(ele.textContent, host)) {
                const style = cloneStyle(ele);
                this.rawElementAppendChild.call(host, style);
                patchCSS(host, style.sheet);
            }
        });
        const links = this.serviceLinks[serviceName];
        links?.forEach((ele) => {
            if (!getLinkInHost(ele, host)) {
                const link = cloneLink(ele);
                this.addNewLink({ serviceName }, host, link);
            }
        });
    }
    addExtraCSS(host, cssContent) {
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
    clearZoneByNodeId(id) {
        this.zoneList[id] = undefined;
        delete this.zoneList[id];
    }
    /**
     * 创建并获取module-cube这个webcomponent dom元素
     * @param id 根据父元素生成的id
     * @param options
     * @returns
     */
    createModuleCubeDom(id, options) {
        const { serviceName, mcAttributes, jsSandboxProps } = options || {};
        let container;
        if (customElements.get(this.mcTagName)) {
            container = document.createElement(this.mcTagName);
        }
        else {
            container = document.createElement('div');
        }
        if ((0, utils_1.isRealObject)(mcAttributes)) {
            for (const [key, value] of Object.entries(mcAttributes)) {
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
    getShadowDom(needShadowDom, container) {
        let subHost;
        if (this.needShadowDom && needShadowDom !== false) {
            const shadowRoot = container.attachShadow({ mode: 'open' });
            subHost = shadowRoot;
        }
        else {
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
    addGlobalDiv(serviceName, options) {
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
        (0, consumer_1.loadCss)(css, subHost);
    }
    /**
     * 根据加载组件的父节点获取id
     * @param hostNode 父节点
     * @param options 服务名和id
     * @returns
     */
    getParentId(hostNode, options) {
        const { serviceName, mcAttributes } = options;
        let id = mcAttributes?.id;
        if (!id) {
            const pId = hostNode.getAttribute('id');
            if (pId) {
                id = `${ID_PREFIX}_${pId}`;
            }
            else {
                id = genId(serviceName);
            }
        }
        return id;
    }
    /**
     * 加载组件失败，需要清理组件，globalDiv先不清理，因为是共用的
     * @param container
     */
    clearModuleCube(container) {
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
    addHost2Params(providerConfig, subHost) {
        if (!providerConfig) {
            return;
        }
        const { params } = providerConfig;
        if (Array.isArray(params)) {
            params.push(subHost);
        }
        else {
            providerConfig.params = [params, subHost];
        }
    }
    /**
     * 在zone里运行一些生命周期钩子回调
     * @param hook
     * @param params
     * @returns
     */
    runLifeHooks(hook, params) {
        if (!hook) {
            return undefined;
        }
        const { zone } = params;
        let ret;
        if (zone) {
            zone.run(() => {
                ret = hook({ ...params });
            });
        }
        else {
            ret = hook({ ...params });
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
    async loadIifeInZone(id, entry, host = document.body) {
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
            }
            else {
                const content = await fetch(entry).then(t => {
                    if (t.status >= 400) {
                        throw new Error('[module-cube] call iife error');
                    }
                    else {
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
        }
        catch (e) {
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
    defaultGenWebComponent(zone, wcTagName) {
        let wc;
        if (zone) {
            zone.run(() => {
                wc = document.createElement(wcTagName);
                wc.zone = zone;
            });
        }
        else {
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
    runInZone(id, serviceName, options) {
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
                this.runLifeHooks(beforeLoadComponent, { zone });
                this.isolateWindowJS(jsSandboxProps);
                if (type === types_1.ModuleType.IIFE) {
                    this.loadIifeInZone(id, entryUrl, cssHost).finally(() => {
                        (0, consumer_1.loadCss)(css, cssHost);
                        r(undefined);
                    });
                }
                else {
                    zone.run(() => {
                        r(loadRemoteComponent(options));
                    });
                }
            }
            else {
                console.warn('[module-cube] no zone.js or no needPatched. run in root');
                r(loadRemoteComponent(options));
            }
        });
    }
    addModule(id, serviceName, host) {
        this.moduleList[id] = {
            serviceName,
            host,
        };
    }
    /**
     * 清除缓存的模块host信息
     * @param id dom的id
     * @param shadowRoot module-cube下的shadowRoot，如果存在则校验，防止重复id替换了之前的shadowRoot
     * @returns
     */
    clearModuleByNodeId(id, shadowRoot) {
        if (!this.moduleList[id]) {
            return;
        }
        if (shadowRoot && this.moduleList[id].host !== shadowRoot) {
            return;
        }
        this.moduleList[id].host = undefined;
        delete this.moduleList[id].host;
        delete this.moduleList[id].serviceName;
        this.moduleList[id] = undefined;
        delete this.moduleList[id];
    }
    /**
     * 做一些收尾处理，主要针对webcomponent组件本身的dom操作
     * @param param0
     * @param options
     */
    afterRun({ module, zone, host }, options) {
        const { wcTagName, wcParams, lifecycle } = options;
        const { beforeGenWC, genWC, beforeAppendWC, afterAppendWC } = lifecycle || {};
        let wc;
        this.runLifeHooks(beforeGenWC, { module, zone, host, wcTagName });
        try {
            wc = this.runLifeHooks(genWC, { module, zone, host, wcTagName });
            if (!wc) {
                wc = this.defaultGenWebComponent(zone, wcTagName);
            }
        }
        catch (e) {
            console.warn('[module-cube] genWC exception', e.message);
            wc = this.defaultGenWebComponent(zone, wcTagName);
        }
        // 把当前的host传递给组件，方便组件查找内部的子元素
        wc.mcHost = host;
        addParams2Node(wc, wcParams);
        this.runLifeHooks(beforeAppendWC, { module, zone, host, wcTagName, wc });
        host.appendChild(wc);
        this.runLifeHooks(afterAppendWC, { module, zone, host, wcTagName, wc });
    }
    async load(hostNode, options) {
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
        this.addHost2Params(options.loaderOption.providerConfig, subHost);
        // 调用远端逻辑
        const module = await this.runInZone(id, serviceName, options);
        if (module?.exception) {
            this.clearModuleCube(container);
            return {
                module,
                zone: null,
                host: null,
            };
        }
        const zone = this.zoneList[id];
        const retObj = {
            module,
            zone,
            host: subHost,
        };
        this.afterRun(retObj, options);
        return retObj;
    }
    isDefineBySandbox(prop) {
        if (!Object.prototype.hasOwnProperty.call(globalThis, prop)) {
            return false;
        }
        const { get, configurable, writable } = Object.getOwnPropertyDescriptor(globalThis, prop);
        if (get?.from === this.jsSandboxLabel || configurable === false || writable === false) {
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
    isolateWindowJS(props) {
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
            const getFn = () => {
                const { serviceName } = getServiceIdByCurrentZone() || {};
                if (serviceName) {
                    globalThis._JSSandbox[serviceName] = globalThis._JSSandbox[serviceName] || {};
                    return globalThis._JSSandbox[serviceName][prop];
                }
                else {
                    return globalThis._JSSandbox.__mcGlobal[prop];
                }
            };
            getFn.from = this.jsSandboxLabel;
            const setFn = v => {
                const { serviceName } = getServiceIdByCurrentZone() || {};
                if (serviceName) {
                    globalThis._JSSandbox[serviceName] = globalThis._JSSandbox[serviceName] || {};
                    globalThis._JSSandbox[serviceName][prop] = v;
                }
                else {
                    globalThis._JSSandbox.__mcGlobal[prop] = v;
                }
                return true;
            };
            Object.defineProperty(globalThis, prop, {
                set: setFn,
                get: getFn,
            });
        }
    }
}
exports.CssSandbox = CssSandbox;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FuZGJveC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9zYW5kYm94LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHlDQUFvRDtBQUNwRCwrQ0FBMkQ7QUFDM0QsbUNBQXNJO0FBQ3RJLG1DQUF3RDtBQUszQyxRQUFBLGdCQUFnQixHQUFHLEtBQUssQ0FBQztBQUV0QyxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUM7QUFDbEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBRXZCOztHQUVHO0FBQ0gsTUFBTSxhQUFhLEdBQUcsRUFBRSxDQUFDO0FBRXpCLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0FBRWhDLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQztBQUVoQyxJQUFJLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztBQUV2Qzs7OztHQUlHO0FBQ0gsU0FBUyxjQUFjLENBQUMsV0FBbUI7SUFDekMsT0FBTyxHQUFHLGlCQUFpQixJQUFJLFdBQVcsRUFBRSxDQUFDO0FBQy9DLENBQUM7QUFFRCxLQUFLLFVBQVUsbUJBQW1CLENBQUMsT0FBOEI7SUFDL0QsTUFBTSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDN0MsSUFBSSxDQUFDO1FBQ0gsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFHLFVBQVUsRUFBRSxDQUFDO1lBQ2QsTUFBTSxHQUFHLE1BQU0sVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzFDLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFFRCxPQUFPLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFD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