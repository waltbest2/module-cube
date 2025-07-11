import { LoadModuleOptions } from "../types";
export type RemoteConfig = {
    type: 'module' | 'script';
    remoteEntry: string;
    [key: string]: unknown;
};
/**
 * 加载远端组件
 * @param options
 * @returns
 */
export declare function loadRemoteModule<T = any>(options: LoadModuleOptions): Promise<T>;
