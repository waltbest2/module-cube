"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRealObject = exports.genRandomString = void 0;
/**
 * 生成随机字符串
 * @returns
 */
function genRandomString() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    else if (globalThis.crypto?.getRandomValues) {
        const length = 12;
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const values = new Uint8Array(length);
        globalThis.crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }
    else {
        return `${Date.now()}`;
    }
}
exports.genRandomString = genRandomString;
function isRealObject(module) {
    return typeof module === 'object' && module !== null;
}
exports.isRealObject = isRealObject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7OztHQUdHO0FBQ0gsU0FBZ0IsZUFBZTtJQUM3QixJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLENBQUM7UUFDbEMsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3hDLENBQUM7U0FBTSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFLENBQUM7UUFDOUMsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sT0FBTyxHQUFHLGdFQUFnRSxDQUFDO1FBQ2pGLElBQUksTUFBTSxHQUFXLEVBQUUsQ0FBQztRQUN4QixNQUFNLE1BQU0sR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxVQUFVLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUUxQyxLQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0IsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO1NBQU0sQ0FBQztRQUNOLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztJQUN6QixDQUFDO0FBQ0gsQ0FBQztBQWxCRCwwQ0FrQkM7QUFFRCxTQUFnQixZQUFZLENBQUMsTUFBTTtJQUNqQyxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLEtBQUssSUFBSSxDQUFDO0FBQ3ZELENBQUM7QUFGRCxvQ0FFQyJ9