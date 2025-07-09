export interface ProviderOption {
  /**
   * 导出方法名
   */
  exportFn?: string;

  /**
   * 输入参数，只在exportFn时有效
   * 
   * 数组时，表示多个参数，如果是单个数组参数，请使用any[][]
   */
  params?: any;

  /**
   * 导出模块名
   */
  exportModule?: string;
}

export interface LoaderOption {
  /**
   * 加载远端组件的入口url
   */
  entryUrl: string;

  /**
   * 对外开放的模式
   * 
   * 默认 module
   */
  type?: 'window' | 'module' | 'iife' | 'systemjs';

  /**
   * type=window下必填
   * 
   * 注意如果是vite模式，则表示模块名，例如import('name/component');
   */
  name?: string;

  /**
   * 对外expose的模块名，例如：'component': './src/components/a.component.ts'
   * 
   * 注意如果是vite模式，则表示组件名，例如import('name/component');
   * 
   * iife下不涉及
   */
  component?: string;

  /**
   * 对外提供的版本号
   */
  version?: string;

  /**
   * 需要加载的css文件路径，支持多个css
   * 
   * 例如：//localhost:8080/usercenter/style.css
   */
  css?: string | string[];

  /**
   * 提供方额外的提供配置
   */
  providerConfig?: ProviderOption;

  /**
   * css挂载的host，可以是shadowDom Host，默认是document.head
   */
  cssHost?: any;

  /**
   * 是否共享库给远端。在某些场景下，例如两边angular版本不一致时，如果强行共享，可能运行错误，所以这是可能需要禁止共享
   * 
   * 默认：true
   */
  needShare?: boolean;

}

/**
 * 远程加载配置
 */
export interface RemoteComponentOption {
  /**
   * web component的tagName
   */
  wcTagName: string;

  /**
   * web component 需要传递的参数
   */
  wcParams?: {
    [key: string]: any;
  }

  /**
   * 子服务名，一定是在静态文件url上出现的服务名。
   */
  serviceName: string;


  /**
   * 加载属性，提供方能力，主要是关于模块联邦相关配置
   */
  loaderOption: LoaderOption;

  /**
   * 额外添加的css样式，用于覆盖外层全局控制的样式，属于调用方，不算到loaderOption中
   */
  extraCss?: string;

  viteLoader?: Function;

  /**
   * 一些生命周期钩子回调，支持业务配置插件能力
   */
  lifecycle?: SandboxLifecycle;

  /**
   * 在<module-cube>上添加属性，例如：style="display:inline-block" id="xxxx"
   */
  mcAttributes?: {
    [key: string]: string;
  }

  /**
   * 需要隔离的window下变量
   * 
   * 搞清楚这个属性的使用过程再选择使用
   */
  jsSandboxProps?: {
    /**
     * window下的属性名
     * 
     * 适合子服务添加的window变量
     * 
     * 不支持delete window.xxx的场景
     */
    prop: string;

    /**
     * 是否需要在卸载时清除该属性值
     * 
     * 建议搞清楚子服务中该属性的具体用法再设置，否则二次渲染时，可能没有值了
     */
    needClear?: boolean;
  }[];
}

export interface ServiceType {
  /**
   * module-cube的id属性值
   */
  serviceId?: string;

  /**
   * module-cube的servicename属性
   */
  serviceName?: string;
}

/**
 * 生命周期钩子入参
 */
export interface LifeParams {
  /**
   * 返回的module, 执行mount后返回的
   */
  module: any;

  /**
   * 当前组件使用的zone
   */
  zone: any;

  /**
   * 当前组件所在的shadowRoot或host
   */
  host: any;

  /**
   * webcomponent的tag名
   */
  wcTagName: string;

  /**
   * webcomponent节点
   */
  wc?: any;
}

/**
 * 生命周期回调钩子，用于自定义逻辑
 */
export interface SandboxLifecycle {
  /**
   * 加载组件之前的处理
   * @param { zone } 归属的zone
   * @returns 
   */
  beforeLoadComponent?: ({zone}: {zone: any}) => void;

  /**
   * 在创建webcomponent之前作的三做的事，例如定义webcomponent
   * @param param0 
   * @returns 
   */
  beforeGenWC?: ({module, zone, host, wcTagName}: LifeParams) => void;

  /**
   * 生成webcomponent节点
   * @param param0
   * @returns 
   */
  genWC?: ({module, zone, host, wcTagName}: LifeParams) => void;

  /**
   * 添加webcomponent组件前执行
   * @param param0 
   * @returns 
   */
  beforeAppendWC?: ({module, zone, host, wcTagName, wc}: LifeParams) => void;

  /**
   * 添加webcomponent组件后执行的事情，如果zone不存在，则直接执行
   * @param param0 
   * @returns 
   */
  afterAppendWC?: ({module, zone, host, wcTagName, wc}: LifeParams) => void;
}

/**
 * 沙箱全局配置
 */
export interface CssSandboxOption {
  /**
   * 堆栈模式能够查询最大的堆栈数量，仅chrome支持
   * 
   * chrome默认10
   */
  maxStack?: number;

  /**
   * 是否需要劫持原生方法
   * 
   * 默认：true
   */
  needPatched?: boolean;

  /**
   * 是否需要shadowdom，如果使用，会有一些局限性，但是样式隔离效果最佳
   * 
   * 默认：true
   */
  needShadowDom?: boolean;

  /**
   * 是否需要错误堆栈兜底分析
   * 
   * 默认：false
   */
  needStackAnlysis?: boolean;

  /**
   * 自定义module-cube的tagNam
   */
  moduleCubeTagName?: string;

}

/**
 * 子服务配置
 */
export interface ServiceOption {

  /**
   * 校验是否是该服务的自定义方法
   * @param option 
   * @returns 
   */
  checkService?: (option: { style?: any; link?: any}) => boolean;

  /**
   * 是否需要shadowDom（服务级），如果使用，会有一些局限性，但是样式隔离效果最佳
   * 
   * 默认：继承系统级
   */
  needShadowDom?: boolean;

  /**
   * 是否需要错误堆栈兜底分析
   * 
   * 默认：true
   */
  needStackAnlysis?: boolean;

  /**
   * 校验是否需要全局添加样式
   * @param host 当前组件的根节点
   * @param element 待添加的style
   * @returns 
   */
  globalCheck?: (host, element) => boolean;

  /**
   * 除去#和. 开头的其他选择器需要在内部查找的，例如webcomponent的tagname
   */
  innerSelectors?: string[];

  /**
   * 全局div是否在全局沙箱中，因为针对某些全局div添加到组件沙箱中，可能导致受到父级div的样式干扰
   * 
   * 因此在body下再新建一个shadowdom的module-cube，只用来存在div，同时组件的所有样式copy到里面
   * 
   * 默认：false
   */
  useGlobalDivSandbox?: boolean;
}
