import { ExportComponent, LoaderOption, ProviderOption } from "../types";
/**
 * 动态加载css样式，如果node是shadowDom，css里面的:root要在构建时改成:host
 * @param cssUrls
 * @param node
 */
export declare function loadCss(cssUrls: string | string[] | undefined, node?: any): void;
export declare function getReturnModule(preModule: any, providerConfig: ProviderOption): {
    mount: () => Promise<any>;
};
export declare function loadComponent(option: LoaderOption): Promise<ExportComponent | undefined>;
