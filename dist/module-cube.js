"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initModuleCubeWebcomponent = void 0;
const sandbox_1 = require("./sandbox");
function initModuleCubeWebcomponent(tagName = 'module-cube') {
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
            if (id?.startsWith(`${sandbox_1.RANDOM_ID_PREFIX}_`)) {
                globalThis._CSSSandbox.clearZoneByNodeId(id);
            }
            globalThis._CSSSandbox.clearModuleByNodeId(id, this.shadowRoot);
            const serviceName = this.getAttribute('servicename') || '';
            const jsSandboxProps = this.jsSandboxProps;
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
exports.initModuleCubeWebcomponent = initModuleCubeWebcomponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kdWxlLWN1YmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvbW9kdWxlLWN1YmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsdUNBQTZDO0FBRTdDLFNBQWdCLDBCQUEwQixDQUFDLFVBQWtCLGFBQWE7SUFDeEUsTUFBTSxVQUFXLFNBQVEsV0FBVztRQUNsQztZQUNFLEtBQUssRUFBRSxDQUFDO1FBQ1YsQ0FBQztRQUVELGlCQUFpQjtZQUNmLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzVCLE9BQU87WUFDVCxDQUFDO1lBRUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ3JELFVBQVUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsQ0FBQztRQUM3RSxDQUFDO1FBRUQsb0JBQW9CO1lBQ2xCLFNBQVM7WUFDVCxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUM1QixPQUFPO1lBQ1QsQ0FBQztZQUVELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkMsSUFBSSxFQUFFLEVBQUUsVUFBVSxDQUFDLEdBQUcsMEJBQWdCLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLFVBQVUsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDL0MsQ0FBQztZQUVELFVBQVUsQ0FBQyxXQUFXLENBQUMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVoRSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzRCxNQUFNLGNBQWMsR0FBSSxJQUFZLENBQUMsY0FBYyxDQUFDO1lBQ3BELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDcEIsT0FBTztZQUNULENBQUM7WUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUN0QyxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLFFBQVEsSUFBSSxFQUFFLENBQUM7Z0JBQzNDLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUM1RCxPQUFPLFVBQVUsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztLQUNGO0lBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNqQyxjQUFjLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUM3QyxDQUFDO0FBQ0gsQ0FBQztBQS9DRCxnRUErQ0MifQ==