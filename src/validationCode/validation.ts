import validateQpuWH from "./types.validate";export function validateIUMMGameConfig(data): any[] {
    var res = validateQpuWH(data);
    return (res === false) ? validateQpuWH.prototype.constructor.errors : [];
}