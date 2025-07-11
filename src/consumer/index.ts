import { patchCSS } from "../sandbox";
import { ExportComponent, LoaderOption, LoadModuleOptions, ModuleType, ProviderOption, VERSION_POS } from "../types";
import { isRealObject } from "../utils";
import { loadRemoteModule } from "./client";

const containerMap = {};

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

/**
 * 用System.js方式加载，解决vite的esmodule语法不兼容zone.js的问题，但是暂时不支持share
 * 
 * 重要注意：会将代码中的动态import()改成module.import()，这是systemjs自己的script方式，不支持esmodule
 * 
 * 所以如果该服务又要引用其他卡片，要考虑对构建产物的转换处理
 * @param config 
 * @returns 
 */
async function loadSystemModule(config: LoadModuleOptions) {
  if (typeof (window as any).System !== 'object') {
    throw new Error('[module-cube] no systemjs, please import systemjs!');
  }

  const { remoteEntry, exposedModule, needInitShare } = config || {};
  if (containerMap[remoteEntry]) {
    return containerMap[remoteEntry];
  }

  const container = await (window as any).System.import(remoteEntry);
  containerMap[remoteEntry] = container;
  if (needInitShare) {
    container.init({});
  }

  const factory = await container.get(exposedModule);
  const Module = factory();
  return Module;
}

function genModuleUnmount(module) {
  const unmountProp = 'unmount';
  Object.defineProperty(module, unmountProp, {
    configurable: false,
    writable: false,
    enumerable: true,
    value: () => {
      if (typeof module.destroy === 'function') {
        module.destroy();
      } else {
        console.warn('[module-cube] no unmount function to run');
      }
    }
  })
}

export function getReturnModule(preModule, providerConfig: ProviderOption) {
  if (!preModule) {
    return undefined;
  }

  let fn;
  let em;
  const { exportFn, exportModule, params } = providerConfig || {};
  if (exportFn) {
    fn = preModule[exportFn];
  }

  if (exportModule) {
    em = preModule[exportModule];
  }

  let module;

  return {
    mount: async () => {
      if (module) {
        return module;
      }

      if (fn) {
        if (Array.isArray(params)) {
          module = await fn.call(null, ...params);
        } else {
          module = await fn.call(null, params);
        }
      } else if (em) {
        module = em;
      } else {
        module = preModule;
      }

      if (isRealObject(module) && !module.unmount) {
        try {
          genModuleUnmount(module);
        } catch (e) {
          console.warn('[module-cube] unmount can not be redefined! maybe can not be called');
        }
      }

      return module;
    }
  }
}

export async function loadComponent(option: LoaderOption): Promise<ExportComponent | undefined> {
  const { entryUrl, name, component, type, version, providerConfig, css, cssHost, needShare = true} = option || {};

  if (css) {
    loadCss(css, cssHost);
  }

  const entry = version ? entryUrl.replace(VERSION_POS, version) : entryUrl;

  const config: LoadModuleOptions = (type === ModuleType.MODULE) ? {
    type: ModuleType.MODULE,
    remoteEntry: entry,
    exposedModule: component!,
    needInitShare: needShare,
  } : {
    type: 'script',
    remoteEntry: entry,
    remoteName: name,
    exposedModule: component!,
    needInitShare: needShare,
  };

  let m;
  if (type === 'systemjs') {
    m = await loadSystemModule(config);
  } else {
    m = await loadRemoteModule(config);
  }

  return getReturnModule(m, providerConfig!);
}