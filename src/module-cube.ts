import { RANDOM_ID_PREFIX } from "./sandbox";

export function initModuleCubeWebcomponent(tagName: string = 'module-cube'): void {
  class ModuleCube extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      if (!globalThis._CSSSandbox) {
        return;
      }

      const id = this.getAttribute('id');
      const serviceName = this.getAttribute('serviceName');
      globalThis._CSSSandbox.addModule(id, serviceName, this.shadowRoot || this);
    }

    disconnectedCallback() {
      // 清理Zone
      if (!globalThis._CSSSandbox) {
        return;
      }

      const id = this.getAttribute('id');
      if (id?.startsWith(`${RANDOM_ID_PREFIX}_`)) {
        globalThis._CSSSandbox.clearZoneByNodeId(id);
      }

      globalThis._CSSSandbox.clearModuleByNodeId(id, this.shadowRoot);

      const serviceName = this.getAttribute('servicename') || '';
      const jsSandboxProps = (this as any).jsSandboxProps;
      if (!jsSandboxProps) {
        return;
      }

      for (const property of jsSandboxProps) {
        const { prop, needClear } = property || {};
        if (globalThis._JSSandbox[serviceName]?.[prop] && needClear) {
          delete globalThis._JSSandbox[serviceName][prop];
        }
      }
    }
  }

  if (!customElements.get(tagName)) {
    customElements.define(tagName, ModuleCube);
  }
}