"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadComponent = exports.getReturnModule = exports.loadCss = void 0;
const sandbox_1 = require("../sandbox");
const types_1 = require("../types");
const utils_1 = require("../utils");
const client_1 = require("./client");
const containerMap = {};
function addCssTag(cssUrl, node) {
    if (!cssUrl) {
        return;
    }
    const link = document.createElement('link');
    link.href = cssUrl;
    link.rel = 'stylessheet';
    link.setAttribute('crossorigin', 'anonymous');
    if (node) {
        node.appendChild(link);
    }
    else {
        document.head.appendChild(link);
    }
    // 动态修改css文件
    link.onload = () => {
        (0, sandbox_1.patchCSS)(node, link.sheet);
    };
}
/**
 * 动态加载css样式，如果node是shadowDom，css里面的:root要在构建时改成:host
 * @param cssUrls
 * @param node
 */
function loadCss(cssUrls, node) {
    if (Array.isArray(cssUrls)) {
        cssUrls.forEach(url => {
            addCssTag(url, node);
        });
    }
    else {
        addCssTag(cssUrls, node);
    }
}
exports.loadCss = loadCss;
/**
 * 用System.js方式加载，解决vite的esmodule语法不兼容zone.js的问题，但是暂时不支持share
 *
 * 重要注意：会将代码中的动态import()改成module.import()，这是systemjs自己的script方式，不支持esmodule
 *
 * 所以如果该服务又要引用其他卡片，要考虑对构建产物的转换处理
 * @param config
 * @returns
 */
async function loadSystemModule(config) {
    if (typeof window.System !== 'object') {
        throw new Error('[module-cube] no systemjs, please import systemjs!');
    }
    const { remoteEntry, exposedModule, needInitShare } = config || {};
    if (containerMap[remoteEntry]) {
        return containerMap[remoteEntry];
    }
    const container = await window.System.import(remoteEntry);
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
            }
            else {
                console.warn('[module-cube] no unmount function to run');
            }
        }
    });
}
function getReturnModule(preModule, providerConfig) {
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
                }
                else {
                    module = await fn.call(null, params);
                }
            }
            else if (em) {
                module = em;
            }
            else {
                module = preModule;
            }
            if ((0, utils_1.isRealObject)(module) && !module.unmount) {
                try {
                    genModuleUnmount(module);
                }
                catch (e) {
                    console.warn('[module-cube] unmount can not be redefined! maybe can not be called');
                }
            }
            return module;
        }
    };
}
exports.getReturnModule = getReturnModule;
async function loadComponent(option) {
    const { entryUrl, name, component, type, version, providerConfig, css, cssHost, needShare = true } = option || {};
    if (css) {
        loadCss(css, cssHost);
    }
    const entry = version ? entryUrl.replace(types_1.VERSION_POS, version) : entryUrl;
    const config = (type === types_1.ModuleType.MODULE) ? {
        type: types_1.ModuleType.MODULE,
        remoteEntry: entry,
        exposedModule: component,
        needInitShare: needShare,
    } : {
        type: 'script',
        remoteEntry: entry,
        remoteName: name,
        exposedModule: component,
        needInitShare: needShare,
    };
    let m;
    if (type === 'systemjs') {
        m = await loadSystemModule(config);
    }
    else {
        m = await (0, client_1.loadRemoteModule)(config);
    }
    return getReturnModule(m, providerConfig);
}
exports.loadComponent = loadComponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3VtZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0NBQXNDO0FBQ3RDLG9DQUFxSDtBQUNySCxvQ0FBd0M7QUFDeEMscUNBQTRDO0FBRTVDLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztBQUV4QixTQUFTLFNBQVMsQ0FBQyxNQUEwQixFQUFFLElBQVU7SUFDdkQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ1osT0FBTztJQUNULENBQUM7SUFDRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO0lBQ25CLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxDQUFDO0lBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzlDLElBQUksSUFBSSxFQUFFLENBQUM7UUFDVCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLENBQUM7U0FBTSxDQUFDO1FBQ04sUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELFlBQVk7SUFDWixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsRUFBRTtRQUNqQixJQUFBLGtCQUFRLEVBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUE7QUFDSCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLE9BQU8sQ0FBQyxPQUFzQyxFQUFFLElBQVU7SUFDeEUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDM0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNwQixTQUFTLENBQUMsR0FB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