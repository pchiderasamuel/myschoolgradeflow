"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var supabaseUrl, supabaseServiceKey, supabase, body, error_1, _a, user, event_type, ip, userAgent, provider, error, err_1;
    var _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                if (req.method === "OPTIONS") {
                    return [2 /*return*/, Response.json({ ok: true }, { status: 204, headers: corsHeaders })];
                }
                _g.label = 1;
            case 1:
                _g.trys.push([1, 7, , 8]);
                supabaseUrl = Deno.env.get("SUPABASE_URL");
                supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
                if (!supabaseUrl || !supabaseServiceKey) {
                    throw new Error("Missing Supabase configuration environment variables.");
                }
                supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseServiceKey);
                body = void 0;
                _g.label = 2;
            case 2:
                _g.trys.push([2, 4, , 5]);
                return [4 /*yield*/, req.json()];
            case 3:
                body = _g.sent();
                return [3 /*break*/, 5];
            case 4:
                error_1 = _g.sent();
                return [2 /*return*/, Response.json({ error: "Invalid JSON payload. Expected a JSON body with user and event_type." }, { status: 400, headers: corsHeaders })];
            case 5:
                _a = body !== null && body !== void 0 ? body : {}, user = _a.user, event_type = _a.event_type;
                if (!user || !user.id || !event_type) {
                    return [2 /*return*/, Response.json({ error: "Missing required fields: user.id and event_type are required." }, { status: 400, headers: corsHeaders })];
                }
                ip = ((_b = req.headers.get("x-forwarded-for")) === null || _b === void 0 ? void 0 : _b.split(",")[0].trim()) || "unknown";
                userAgent = req.headers.get("user-agent") || "unknown";
                provider = ((_c = user.app_metadata) === null || _c === void 0 ? void 0 : _c.provider) || ((_e = (_d = user.identities) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.provider) || "email";
                return [4 /*yield*/, supabase.from("session_logs").insert({
                        user_id: user.id,
                        event: event_type,
                        ip_address: ip,
                        user_agent: userAgent,
                        provider: provider,
                    })];
            case 6:
                error = (_g.sent()).error;
                if (error) {
                    throw error;
                }
                return [2 /*return*/, Response.json({ success: true }, { status: 200, headers: corsHeaders })];
            case 7:
                err_1 = _g.sent();
                console.error("Error in log-session function:", err_1);
                return [2 /*return*/, Response.json({ error: (_f = err_1 === null || err_1 === void 0 ? void 0 : err_1.message) !== null && _f !== void 0 ? _f : "Internal server error" }, { status: 500, headers: corsHeaders })];
            case 8: return [2 /*return*/];
        }
    });
}); });
