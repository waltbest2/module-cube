import { CssSandboxOption, RemoteComponentOption, ServiceOption } from './types';
export declare const RANDOM_ID_PREFIX = "Rmc";
export declare function patchCSS(node: any, sheet: any, mediaConditionText?: any): void;
export declare class CssSandbox {
    /**
     * 是否需要patch
     */
    private needPatched;
    /**
     * 是否需要shadowDom包裹
     */
    private needShadowDom;
    /**
     * 是否已经被patch了
     */
    private alreadyPatched;
    private needStackAnlysis;
    /**
     * 记录每个服务的配置信息
     */
    private serviceList;
    /**
     * 记录每个子服务加载的style，在mount时还原这些style
     */
    private serviceStyles;
    /**
     * 记录每个子服务加载的link，在mount时还原这些link
     */
    private serviceLinks;
    /**
     * 框架库用的是哪个服务，考虑模块联邦去中心化，angular的appendChild可能是不同服务，所以动态配置
     */
    private mainService;
    /**
     * 保存所有创建的zone
     */
    private zoneList;
    /**
     * 保存当前document下所有的host节点，如果有shadowDom，就是shadowDom，否则就是module-cube节点
     */
    private moduleList;
    private readonly jsSandboxLabel;
    private mcTagName;
    private mcTagNameUpper;
    /**
     * 下面开始保存各个劫持的原生方法
     */
    private rawBodyAppendChild;
    private rawHeadAppendChild;
    private rawElementAppendChild;
    private rawNodeAppendChild;
    private rawBodyRemoveChild;
    private rawHeadRemoveChild;
    private rawElementRemoveChild;
    private rawNodeRemoveChild;
    private rawElementRemove;
    private rawCustomElementsDefine;
    private rawGetComputedStyle;
    private rawDocumentQuerySelector;
    private rawDocumentQuerySelectorAll;
    private rawInsertAdjacentElement;
    /**
     * 用于缓存iife加载的入口js内容，防止重复fetch
     */
    entryIIFEJsCache: {};
    readonly version = "@mc_version";
    constructor(options?: CssSandboxOption);
    /**
     * 根据服务判断是否需要根据stack分析
     * @param service
     * @returns 空字符串表示没有匹配到
     */
    private checkServiceStackConfig;
    /**
     * 从调用栈获取相关服务
     * @param callstack
     * @param services
     * @returns
     */
    private getListFromErrorStack;
    private check;
    /**
     * 补充子服务配置信息，支持重复执行，后面设置会覆盖前面设置
     * @param service 重要：一定是静态url上的服务名
     * @param option
     */
    addService(service: string, option?: ServiceOption): void;
    /**
     * 获取对应的module-cube
     * @param service id或服务名，如果是服务名，默认第一个
     * @param checkGlobal 是否需要在global中查找
     * @returns 对应某个module-cube
     */
    getHost(service: any, checkGlobal?: boolean): any;
    /**
     * 将样式复制到其他同类节点
     * @param service
     * @param element
     * @param includeHead
     * @returns
     */
    private cloneStyle2OtherHost;
    /**
     * 将link复制到其它同类节点
     * @param service
     * @param element
     * @returns
     */
    private cloneLink2OtherHost;
    /**
     * 除了第一个执行的组件外，其他相同组件也需要添加样式
     * @param service
     * @param element
     * @param includeHead
     */
    private cloneCSS2OtherHost;
    /**
     * 校验这个样式是不是全局
     * @param service
     * @param element
     * @returns
     */
    private checkGlobalCSS;
    /**
     * 给host添加link，同时添加到当前页面其他相同元素
     * @param service 服务信息
     * @param host 宿主节点
     * @param element link元素
     * @param checkExist 针对主动添加link的场景，如果已经存在，把自己删掉
     * @returns
     */
    private addNewLink;
    /**
     * 同一个组件，可能只会增加一次
     * @param service
     * @param element
     * @param includeHead
     */
    private patchStyleAppend;
    /**
     * 添加link额外处理
     * @param service
     * @param element
     * @returns
     */
    private patchLinkAppend;
    /**
     * 劫持appendChild
     *
     * rawElementAppendChild 表示 Node.prototype
     * @param point
     * @param rawFn
     */
    private patchElementAppendChild;
    /**
     * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的appendChild
     */
    private patchHeadAppendChild;
    private patchBodyAppendChild;
    /**
     * 劫持不同层面的原型上的appendChild
     */
    private patchAppendChild;
    /**
     * 劫持removeChild
     * @param point
     * @param rawFn
     */
    private patchElementRemoveChild;
    /**
     * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的removeChild
     */
    private patchHeadRemoveChild;
    /**
     * 为了适配qiankun，劫持HTMLHeadElement和HTMLBodyElement原型的removeChild
     */
    private patchBodyRemoveChild;
    /**
     * 劫持不同层面的原型上的removeChild
     */
    private patchRemoveChild;
    /**
     * 动态删除style的时候，需要清理缓存的styles，下次可以自动添加
     */
    private patchElementRemove;
    /**
     * 劫持querySelector，如果是在子服务中，则优先在shadowdom中找，找不到去document中找
     */
    private patchDocumentQuerySelector;
    /**
     * 劫持原生customElement.define
     *
     * 仿照Zone.js的劫持
     */
    private patchCustomElementDefine;
    /**
     * getComputedStyle(shadowRoot) 会报错，仿照处理下
     */
    private patchGetComputedStyle;
    /**
     * 检查该接口是不是在module-cube的shadowDom中，并返回shadowDom
     * @param element
     */
    private getShadowWhenInModuleCube;
    /**
     * 为了适配vite开发态，Style.insertAdjacentElement劫持处理
     */
    private patchInsertAdjacentElement;
    /**
     * 整体patch
     */
    private patch;
    /**
     * 取消patch
     */
    unpatch(): void;
    private appendExistStylesAndLinks;
    private addExtraCSS;
    /**
     * 清理zone
     * @param id
     */
    clearZoneByNodeId(id: string): void;
    /**
     * 创建并获取module-cube这个webcomponent dom元素
     * @param id 根据父元素生成的id
     * @param options
     * @returns
     */
    private createModuleCubeDom;
    /**
     * 创建并获取module-cube下的shadowDom,如果不需要返回module-cube
     * @param needShadowDom 服务配置是否需要shadowDom
     * @param container module-cube容器
     * @returns shadowRoot或module-cube
     */
    private getShadowDom;
    /**
     * 在body添加全局div
     * @param serviceName
     * @param options
     * @returns
     */
    private addGlobalDiv;
    /**
     * 根据加载组件的父节点获取id
     * @param hostNode 父节点
     * @param options 服务名和id
     * @returns
     */
    private getParentId;
    /**
     * 加载组件失败，需要清理组件，globalDiv先不清理，因为是共用的
     * @param container
     */
    private clearModuleCube;
    /**
     * 把shadowDom host加入到参数中
     * @param providerConfig
     * @param subHost
     * @returns
     */
    private addHost2Params;
    /**
     * 在zone里运行一些生命周期钩子回调
     * @param hook
     * @param params
     * @returns
     */
    private runLifeHooks;
    /**
     * 不是用模块联邦，立即执行函数，直接加载，为了能确定运行zone
     *
     * js只需要加载一次，不需要多次加载。
     * @param id
     * @param entry
     * @param host
     * @returns
     */
    private loadIifeInZone;
    /**
     * 用create的默认方式生成webcomponent组件
     * @param zone
     * @param wcTagName
     * @returns
     */
    private defaultGenWebComponent;
    /**
     * 在zone中执行
     * @param id
     * @param serviceName
     * @param options
     * @returns
     */
    private runInZone;
    addModule(id: string, serviceName: string, host: any): void;
    /**
     * 清除缓存的模块host信息
     * @param id dom的id
     * @param shadowRoot module-cube下的shadowRoot，如果存在则校验，防止重复id替换了之前的shadowRoot
     * @returns
     */
    clearModuleByNodeId(id: string, shadowRoot?: ShadowRoot): void;
    /**
     * 做一些收尾处理，主要针对webcomponent组件本身的dom操作
     * @param param0
     * @param options
     */
    private afterRun;
    load(hostNode: any, options: RemoteComponentOption): Promise<{
        module: any & {
            unmount: Function;
        } & {
            exception: Error;
        };
        host: any;
        zone: any;
    }>;
    private isDefineBySandbox;
    /**
     * 一定的window变量隔离能力，但是没法监听delete操作
     *
     * 不支持delete window.prop
     * @param props
     * @returns
     */
    private isolateWindowJS;
}
