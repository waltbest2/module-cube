import { LoadModuleOptions } from "../types";

type Factory = () => any;
type Scope = unknown;

type Container = {
  get(module: string): Factory;
  init(shareScope: Scope): void;
}

export type RemoteConfig = {
  type: 'module' | 'script';
  remoteEntry: string;
  [key: string]: unknown;
}

declare const __webpack_init_sharing__: (shareScope: string) => Promise<void>;
declare const __webpack_share_scopes__: { default: Scope };

const containerMap = {};
const remoteContainerMap = {};

let isScopeInitialized = false;

/**
 * 初始化share池，将host的share池共享给remote，这样host和remote指向同一个share池
 * @param container 
 * @param key 
 * @returns 
 */
async function initRemote(container: Container, key: string) {
  if (remoteContainerMap[key]) {
    return container;
  }

  // 初始化host的share池
  if (!isScopeInitialized) {
    await __webpack_init_sharing__('default');
    isScopeInitialized = true;
  }

  try {
    if (container) {
      // 将host的share池共享给remote，对remote进行初始化，但是可能remote已经有另外一个share池，因此会报错
      await container.init(__webpack_share_scopes__.default);
      remoteContainerMap[key] = true;
    }
  } catch (e) {
    // 在把host share池给remote时，remote已经拥有了一个share池，因此会报错，这时继续使用remote已有的share池
    console.warn('[module-cube] container.int exception ', e.message);
  }

  return container;
}

function loadModuleEntry(remoteEntry: string, needInitShare: boolean = true): Promise<Container> {
  if (containerMap[remoteEntry]) {
    return containerMap[remoteEntry];
  }

  containerMap[remoteEntry] = import(/* webpackIgnore:true */ remoteEntry).then(async container => {
    if (needInitShare) {
      await initRemote(container, remoteEntry);
    }

    return container;
  });

  return containerMap[remoteEntry];
}

/**
 * script方式加载脚本入口函数
 * @param remoteEntry 
 * @param remoteName 
 * @param needInitShare 是否需要要初始化共享，默认 true
 * @returns 
 */
function loadScriptEntry(remoteEntry: string, remoteName: string, needInitShare: boolean = true): Promise<Container> {
  if (containerMap[remoteEntry]) {
    return containerMap[remoteEntry];
  }

  containerMap[remoteEntry] = new Promise<Container>((resolve, reject) => {
    let script: any = document.createElement('script');
    script.onload = async () => {
      const container = window[remoteName] as Container;

      if (needInitShare) {
        await initRemote(container, remoteEntry);
      }

      script.remove();
      script = null;
      resolve(container);
    };
    script.onerror = reject;
    script.src = remoteEntry;

    document.body.appendChild(script);
  });

  return containerMap[remoteEntry];
}

function loadRemoteEntry(options: LoadModuleOptions): Promise<Container> {
  const { type, remoteEntry, remoteName, needInitShare } = options || {};

  if (type === 'module') {
    return loadModuleEntry(remoteEntry, needInitShare);
  } else {
    return loadScriptEntry(remoteEntry, remoteName!, needInitShare);
  }
}

/**
 * 获取远端模块
 * @param container 
 * @param exposedModule 
 * @returns 
 */
async function getExposedModule<T>(container: Container, exposedModule: string): Promise<T> {
  if (typeof container?.get === 'function') {
    const factory = await container.get(exposedModule);
    const Module = factory();
    return <T>Module;
  } else {
    return Promise.resolve(<T>container);
  }
}
/**
 * 加载远端组件
 * @param options 
 * @returns 
 */
export async function loadRemoteModule<T = any>(options: LoadModuleOptions): Promise<T> {
  const { exposedModule } = options || {};

  const container = await loadRemoteEntry(options);

  return getExposedModule<T>(container, exposedModule);
}