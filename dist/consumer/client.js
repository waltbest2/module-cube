"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRemoteModule = void 0;
const containerMap = {};
const remoteContainerMap = {};
let isScopeInitialized = false;
/**
 * 初始化share池，将host的share池共享给remote，这样host和remote指向同一个share池
 * @param container
 * @param key
 * @returns
 */
async function initRemote(container, key) {
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
    }
    catch (e) {
        // 在把host share池给remote时，remote已经拥有了一个share池，因此会报错，这时继续使用remote已有的share池
        console.warn('[module-cube] container.int exception ', e.message);
    }
    return container;
}
function loadModuleEntry(remoteEntry, needInitShare = true) {
    if (containerMap[remoteEntry]) {
        return containerMap[remoteEntry];
    }
    containerMap[remoteEntry] = Promise.resolve(`${remoteEntry}`).then(s => __importStar(require(s))).then(async (container) => {
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
function loadScriptEntry(remoteEntry, remoteName, needInitShare = true) {
    if (containerMap[remoteEntry]) {
        return containerMap[remoteEntry];
    }
    containerMap[remoteEntry] = new Promise((resolve, reject) => {
        let script = document.createElement('script');
        script.onload = async () => {
            const container = window[remoteName];
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
function loadRemoteEntry(options) {
    const { type, remoteEntry, remoteName, needInitShare } = options || {};
    if (type === 'module') {
        return loadModuleEntry(remoteEntry, needInitShare);
    }
    else {
        return loadScriptEntry(remoteEntry, remoteName, needInitShare);
    }
}
/**
 * 获取远端模块
 * @param container
 * @param exposedModule
 * @returns
 */
async function getExposedModule(container, exposedModule) {
    if (typeof container?.get === 'function') {
        const factory = await container.get(exposedModule);
        const Module = factory();
        return Module;
    }
    else {
        return Promise.resolve(container);
    }
}
/**
 * 加载远端组件
 * @param options
 * @returns
 */
async function loadRemoteModule(options) {
    const { exposedModule } = options || {};
    const container = await loadRemoteEntry(options);
    return getExposedModule(container, exposedModule);
}
exports.loadRemoteModule = loadRemoteModule;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN1bWVyL2NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW1CQSxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7QUFDeEIsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7QUFFOUIsSUFBSSxrQkFBa0IsR0FBRyxLQUFLLENBQUM7QUFFL0I7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsVUFBVSxDQUFDLFNBQW9CLEVBQUUsR0FBVztJQUN6RCxJQUFJLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDNUIsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVELGlCQUFpQjtJQUNqQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUN4QixNQUFNLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUM1QixDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0gsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLG1FQUFtRTtZQUNuRSxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdkQsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNYLHdFQUF3RTtRQUN4RSxPQUFPLENBQUMsSUFBSSxDQUFDLHdDQUF3QyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLFdBQW1CLEVBQUUsZ0JBQXlCLElBQUk7SUFDekUsSUFBSSxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztRQUM5QixPQUFP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