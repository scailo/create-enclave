#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var child_process = require("child_process");
var ts = require("typescript");
var prompt = require("@inquirer/prompts");
var crypto = require("crypto");
var applicationIdentifier = "scailo-test-widget";
var applicationName = "Scailo Test Widget";
var version = "0.0.1";
var rootFolder = path.dirname(__dirname);
var selectedEnclaveTemplate = "node";
var selectedEntryPointManagement = "platform_redirect";
function acceptUserInputs() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prompt.input({
                        message: "Enter the Application Name: ",
                        default: applicationName,
                        required: true,
                        validate: function (input) { return input.length > 0; }
                    })];
                case 1:
                    applicationName = (_a.sent()).trim();
                    return [4 /*yield*/, prompt.input({
                            message: "Enter the Application Identifier: ",
                            default: applicationIdentifier,
                            required: true,
                            validate: function (input) { return input.length > 0; }
                        })];
                case 2:
                    applicationIdentifier = (_a.sent()).trim();
                    return [4 /*yield*/, prompt.input({
                            message: "Enter the Initial Version Number (Semver Format): ",
                            default: version,
                            required: true,
                            validate: function (input) { return input.length > 0; }
                        })];
                case 3:
                    version = (_a.sent()).trim();
                    return [4 /*yield*/, prompt.select({
                            message: "Select the Enclave Template",
                            choices: [
                                { name: "Node", value: "node", description: "Create a Node based Enclave" },
                                { name: "Golang", value: "golang", description: "Create a Golang based Enclave" },
                                { name: "Python", value: "python", description: "Create a Python based Enclave" },
                            ], default: ""
                        })];
                case 4:
                    selectedEnclaveTemplate = (_a.sent()).trim();
                    return [4 /*yield*/, prompt.select({
                            message: "Select the Entry Point Type",
                            choices: [
                                { name: "Platform Redirect", value: "platform_redirect", description: "Entry Point will be managed by the Platform. The application will need to implement: GET /enclave/".concat(applicationIdentifier, "/ingress/{token}") },
                                { name: "Direct URL", value: "direct_url", description: "Entry Point will be managed by the Application. The application will need to implement: GET /" },
                            ], default: "platform_redirect"
                        })];
                case 5:
                    selectedEntryPointManagement = (_a.sent()).trim();
                    console.log("Application Name: ".concat(applicationName));
                    console.log("Application Identifier: ".concat(applicationIdentifier));
                    console.log("Version: ".concat(version));
                    console.log("Enclave Template: ".concat(selectedEnclaveTemplate));
                    console.log("Entry Point Type: ".concat(selectedEntryPointManagement));
                    return [2 /*return*/];
            }
        });
    });
}
function spawnChildProcess(command, args, options) {
    if (args === void 0) { args = []; }
    if (options === void 0) { options = {}; }
    return new Promise(function (resolve, reject) {
        var child = child_process.spawn(command, args, __assign(__assign({}, options), { shell: process.platform === "win32" ? true : undefined }));
        // Optional: Log stdout and stderr for debugging
        child.stdout.on('data', function (data) {
            console.log("".concat(data));
        });
        child.stderr.on('data', function (data) {
            console.error("stderr: ".concat(data));
        });
        child.on('close', function (code) {
            if (code === 0) {
                resolve("Child process exited with code ".concat(code));
            }
            else {
                reject(new Error("Child process exited with code ".concat(code)));
            }
        });
        child.on('error', function (err) {
            reject(err);
        });
    });
}
function setupGitIgnore() {
    return __awaiter(this, void 0, void 0, function () {
        var gitignoreList;
        return __generator(this, function (_a) {
            gitignoreList = [
                "node_modules/",
                ".env",
                "tsconfig.tsbuildinfo",
                ".DS_Store"
            ];
            fs.writeFileSync(".gitignore", gitignoreList.join("\n").trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function setupCommonNPMDependencies() {
    return __awaiter(this, void 0, void 0, function () {
        var npmDependencies, npmDevDependencies;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    npmDependencies = [
                        "@kernelminds/scailo-sdk@latest",
                        "@bufbuild/protobuf@1.10.0",
                        "@connectrpc/connect-web@1.7.0",
                        "path-to-regexp@6.1.0"
                    ];
                    return [4 /*yield*/, spawnChildProcess("npm", __spreadArray(__spreadArray(["install"], npmDependencies, true), ["--save"], false))];
                case 1:
                    _a.sent();
                    npmDevDependencies = [
                        "tailwindcss",
                        "@tailwindcss/cli",
                        "daisyui@latest",
                        "esbuild",
                        "@inquirer/prompts@7.8.6",
                        "concurrently@9.2.1",
                        "semver",
                        "@types/semver",
                        "yaml",
                        "adm-zip",
                        "@types/adm-zip",
                        "typescript",
                        "@types/node",
                        "favicons",
                    ];
                    return [4 /*yield*/, spawnChildProcess("npm", __spreadArray(__spreadArray(["install"], npmDevDependencies, true), ["--save-dev"], false))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setupDependencies(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var enclaveType = _b.enclaveType;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(enclaveType == "node")) return [3 /*break*/, 2];
                    return [4 /*yield*/, setupDependenciesForNode()];
                case 1:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 2:
                    if (!(enclaveType == "golang")) return [3 /*break*/, 4];
                    return [4 /*yield*/, setupDependenciesForGolang()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    if (!(enclaveType == "python")) return [3 /*break*/, 6];
                    return [4 /*yield*/, setupDependenciesForPython()];
                case 5:
                    _c.sent();
                    _c.label = 6;
                case 6: 
                // Create the tsconfig.json
                return [4 /*yield*/, spawnChildProcess("npx", ["tsc", "--init"])];
                case 7:
                    // Create the tsconfig.json
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setupDependenciesForNode() {
    return __awaiter(this, void 0, void 0, function () {
        var npmDependencies;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setupCommonNPMDependencies()];
                case 1:
                    _a.sent();
                    npmDependencies = [
                        "@connectrpc/connect-node@1.7.0",
                        "fastify@4.28.1",
                        "@fastify/static@7.0.4",
                        "fastify-favicon@4.3.0",
                        "dotenv",
                        "redis@4.7.0",
                        "@fastify/cookie@9.4.0",
                        "pino-pretty@13.1.2"
                    ];
                    return [4 /*yield*/, spawnChildProcess("npm", __spreadArray(__spreadArray(["install"], npmDependencies, true), ["--save"], false))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setupDependenciesForGolang() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setupCommonNPMDependencies()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setupDependenciesForPython() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setupCommonNPMDependencies()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setupScripts() {
    return __awaiter(this, void 0, void 0, function () {
        var scriptsFolderName, folders, _i, folders_1, folder;
        return __generator(this, function (_a) {
            scriptsFolderName = path.join("scripts");
            folders = [
                path.join(scriptsFolderName),
            ];
            for (_i = 0, folders_1 = folders; _i < folders_1.length; _i++) {
                folder = folders_1[_i];
                fs.mkdirSync(folder, { recursive: true });
            }
            // Copy package.ts
            fs.copyFileSync(path.join(rootFolder, "src", "package.ts"), path.join(scriptsFolderName, "package.ts"));
            return [2 /*return*/];
        });
    });
}
function createResourcesFolders() {
    var resourcesFolderName = path.join("resources");
    var distFolderName = path.join(resourcesFolderName, "dist");
    var srcFoldername = path.join(resourcesFolderName, "src");
    var resourcesFolders = [
        path.join(resourcesFolderName),
        path.join(distFolderName),
        path.join(distFolderName, "css"),
        path.join(distFolderName, "img"),
        path.join(distFolderName, "js"),
        path.join(srcFoldername),
        path.join(srcFoldername, "ts"),
        path.join(srcFoldername, "css")
    ];
    for (var _i = 0, resourcesFolders_1 = resourcesFolders; _i < resourcesFolders_1.length; _i++) {
        var folder = resourcesFolders_1[_i];
        fs.mkdirSync(folder, { recursive: true });
    }
    var appCSSPath = path.join(srcFoldername, "css", "app.css");
    var appEntryTSPath = path.join(srcFoldername, "ts", "app.ts");
    var routerEntryTSPath = path.join(srcFoldername, "ts", "router.ts");
    // Copy the img folder
    fs.cpSync(path.join(rootFolder, "img"), path.join(distFolderName, "img"), { recursive: true });
    return {
        appCSSPath: appCSSPath,
        distFolderName: distFolderName,
        appEntryTSPath: appEntryTSPath,
        routerEntryTSPath: routerEntryTSPath
    };
}
function createBuildScripts(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var packageJSON, packageJSONScripts, scripts, i, script;
        var appCSSPath = _b.appCSSPath, distFolderName = _b.distFolderName, appEntryTSPath = _b.appEntryTSPath, enclaveType = _b.enclaveType;
        return __generator(this, function (_c) {
            packageJSON = JSON.parse(fs.readFileSync("package.json", "utf-8"));
            packageJSONScripts = packageJSON.scripts || {};
            scripts = [
                ["css:build", "npx tailwindcss -i ".concat(appCSSPath, " -o ").concat(path.join(distFolderName, "css", "bundle.css"), " --minify")],
                ["css:watch", "npx tailwindcss -i ".concat(appCSSPath, " -o ").concat(path.join(distFolderName, "css", "bundle.css"), " --watch")],
                ["ui:build", "npx esbuild ".concat(appEntryTSPath, " --bundle --outfile=").concat(path.join(distFolderName, "js", "bundle.src.min.js"), " --minify")],
                ["ui:watch", "npx esbuild ".concat(appEntryTSPath, " --bundle --outfile=").concat(path.join(distFolderName, "js", "bundle.src.min.js"), " --watch")],
                ["dev:watch", "npx concurrently \"npm run ui:watch\" \"npm run css:watch\""],
                ["package", "npx tsx scripts/package.ts"],
            ];
            if (enclaveType == "node") {
                scripts.push(["dev:start", "npx tsx -r dotenv/config server.ts"]);
                scripts.push(["start", "npx tsx server.ts"]); // This is in production
            }
            else if (enclaveType == "golang") {
                scripts.push(["dev:start", "go run ."]);
                scripts.push(["start", "go run ."]); // This is in production
            }
            else if (enclaveType == "python") {
                scripts.push(["dev:start", "uv run server.py"]);
                scripts.push(["start", "uv run server.py"]); // This is in production
            }
            for (i = 0; i < scripts.length; i++) {
                script = scripts[i];
                packageJSONScripts[script[0]] = script[1];
            }
            packageJSON.scripts = packageJSONScripts;
            packageJSON.version = version;
            fs.writeFileSync("package.json", JSON.stringify(packageJSON, null, 2), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function createIndexHTML(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var hrefPrefix, html;
        var appName = _b.appName, version = _b.version, enclaveName = _b.enclaveName, selectedEntryPointManagement = _b.selectedEntryPointManagement;
        return __generator(this, function (_c) {
            hrefPrefix = selectedEntryPointManagement == "platform_redirect" ? "/enclave/".concat(enclaveName) : "";
            html = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <link rel=\"shortcut icon\" href=\"".concat(hrefPrefix, "/resources/dist/img/favicon.ico\" type=\"image/x-icon\">\n    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge,chrome=1\" />\n    <link rel=\"preload\" as=\"script\" href=\"").concat(hrefPrefix, "/resources/dist/js/bundle.src.min.js\">\n    <link rel=\"stylesheet\" href=\"").concat(hrefPrefix, "/resources/dist/css/bundle.css\">\n    <title>").concat(appName, "</title>\n</head>\n<body class=\"text-gray-800\">\n    <div class=\"container text-center\">\n        <h1 class=\"text-3xl font-bold\">").concat(appName, "</h1>\n    </div>\n    <div id=\"container\" class=\"container\"></div>\n    <!-- Attach the JS bundle here -->\n    <script src=\"").concat(hrefPrefix, "/resources/dist/js/bundle.src.min.js\"></script>\n</body>\n</html>\n");
            // Create index.html
            fs.writeFileSync("index.html", html.trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function createEntryTS(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var script;
        var appEntryTSPath = _b.appEntryTSPath, enclaveName = _b.enclaveName, selectedEntryPointManagement = _b.selectedEntryPointManagement;
        return __generator(this, function (_c) {
            script = "\nimport { createConnectTransport } from \"@connectrpc/connect-web\";\nimport { Router } from \"./router\";\n\nexport const enclaveName = \"".concat(enclaveName, "\";\n\n/**\n * Message handler type for Scailo widget. Receives messages from the parent application\n */\nexport type ScailoWidgetMessage = {\n    type: \"refresh\",\n    payload: any\n};\n\n/**\n * Message handler for Scailo widget\n */\nwindow.addEventListener(\"message\", (evt: MessageEvent<ScailoWidgetMessage>) => {\n    if (evt.data.type == \"refresh\") {\n        location.reload();\n    }\n});\n\nasync function wait(ms: number) {\n    return new Promise(resolve => setTimeout(resolve, ms));\n}\n\n/** Starts the router  */\nfunction startRouter() {\n    let r = new Router();\n    const routePrefix = ").concat(selectedEntryPointManagement == "platform_redirect" ? "\`/enclave/\${enclaveName}\`" : "``", ";\n    r.add(`${routePrefix}/ui`, async (ctx) => {\n        const container = document.getElementById(\"container\") as HTMLDivElement;\n        while (true) {\n            await wait(1000);\n            let payload = await (await fetch(`${routePrefix}/api/random`, { method: \"GET\", headers: { \"Content-Type\": \"application/json\" } })).json() as { random: number };\n            container.innerHTML = payload.random.toString();\n        }\n    });\n\n    r.add(`${routePrefix}/404`, async (ctx) => {\n        handlePageNotFound(ctx);\n    });\n\n    r.setDefault((ctx) => {\n        location.href = `${routePrefix}/ui`;\n    });\n\n    r.start();\n}\n\n/** Handles page not found */\nfunction handlePageNotFound(ctx: any) {\n    let content = <HTMLDivElement>document.getElementById(\"container\");\n    content.innerHTML = \"Invalid page\";\n}\n\nwindow.addEventListener(\"load\", async (evt) => {\n    evt.preventDefault();\n    startRouter();\n});\n\nexport function getReadTransport() {\n    return createConnectTransport({\n        // Need to use binary format (at least for the time being)\n        baseUrl: location.origin, useBinaryFormat: false, interceptors: []\n    });\n}\n");
            // Create index.ts
            fs.writeFileSync(appEntryTSPath, script.trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function createRouterTS(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var script;
        var routerEntryTSPath = _b.routerEntryTSPath;
        return __generator(this, function (_c) {
            script = "\n\nimport { match, MatchFunction } from \"path-to-regexp\";\n\n/**Stores the relationship between the path and the provided callback */\ninterface relation {\n    path: MatchFunction<object> | null\n    callback: (ctx: context) => void\n}\n\n/**Class that performs the routing */\nexport class Router {\n    relationships: relation[]\n    defaultRelation: relation\n\n    constructor() {\n        this.relationships = [];\n        this.defaultRelation = <relation>{};\n    }\n\n    /**Adds a path along with the callback to the router */\n    add(path: string, callback: (ctx: context) => void) {\n        let r = <relation>{\n            path: match(path),\n            callback: callback\n        };\n        this.relationships.push(r);\n    }\n\n    setDefault(callback: (ctx: context) => void) {\n        this.defaultRelation = {\n            path: null,\n            callback: callback\n        }\n    }\n\n    /**Navigates the user to the provided href */\n    private _navigate(href: string, searchParams: string) {\n        if (!href.startsWith(\"tel\")) {\n            history.pushState({ href: href, searchParams: searchParams }, \"\", href + searchParams);\n            this.traverseRelationships(href, searchParams);\n        }\n    }\n\n    private traverseRelationships(href: string, searchParams: string) {\n        for (let i = 0; i < this.relationships.length; i++) {\n            let t = this.relationships[i];\n            let match = t.path!(href);\n            if (match) {\n                let c = <context>{\n                    querystring: searchParams,\n                    pathname: href,\n                    path: href + searchParams,\n                    params: match.params\n                }\n                t.callback(c);\n                return\n            }\n        }\n        this.defaultRelation.callback({\n            querystring: location.search,\n            pathname: location.pathname,\n            path: location.pathname + location.search,\n            params: null\n        });\n    }\n\n    _handleAnchorTag(t: HTMLAnchorElement, e: MouseEvent) {\n        if (t.getAttribute(\"download\") != null || t.getAttribute(\"target\") != null || t.getAttribute(\"href\") == null) {\n            return true\n        } else {\n            // Prevent default only in the case where the default functionality of the link is being overridden\n            e.preventDefault();\n            let tempHref = t.href.replace(location.origin, \"\");\n            let split = tempHref.split(\"?\");\n            let href = \"\";\n            let searchParams = \"\";\n            if (split.length == 1) {\n                href = split[0];\n            } else {\n                href = split[0];\n                searchParams = \"?\" + split[1];\n            }\n            this._navigate(href, searchParams);\n        }\n    }\n\n    /**Starts the router */\n    start() {\n        let localThis = this;\n        document.addEventListener(\"click\", e => {\n            if (e.ctrlKey || e.metaKey) {\n                // If control key or any other modifier key has been clicked, do not handle it wih this library\n                return true\n            }\n            let el = <HTMLElement>e.target;\n            if (el.nodeName.toLowerCase() == \"a\") {\n                this._handleAnchorTag(<HTMLAnchorElement>el, e);\n            } else if (el.nodeName.toLowerCase() == \"button\") {\n                return true\n            } else {\n                let parentAnchor: HTMLAnchorElement | null = null;\n                let parentEl = el.parentElement;\n                if (parentEl == null) {\n                    return true\n                }\n                while (parentEl != null) {\n                    if (parentEl.nodeName.toLowerCase() == \"body\") {\n                        break\n                    }\n                    if (parentEl.nodeName.toLowerCase() == \"a\") {\n                        parentAnchor = <HTMLAnchorElement>parentEl;\n                        break\n                    }\n                    parentEl = parentEl.parentElement;\n                }\n                if (parentAnchor == null) {\n                    return true\n                }\n                // Handle click of the parent element here\n                this._handleAnchorTag(parentAnchor, e);\n            }\n        });\n\n        window.addEventListener(\"popstate\", function (e) {\n            e.preventDefault();\n            localThis.traverseRelationships(location.pathname, location.search)\n        });\n\n        /**Create the global function to route to a certain URL */\n        (<any>window).routeTo = function (url: string) {\n            let t = new URL(location.origin + url);\n            localThis._navigate(t.pathname, t.search);\n        }\n\n        this._navigate(location.pathname, location.search);\n    }\n}\n\n/**Stores the router parameters */\nexport interface context {\n    querystring: string\n    /**Is the object that consists of the matched parameters */\n    params: any\n    /**The pathname void of query string \"/login\" */\n    pathname: string\n    /**Pathname and query string \"/login?foo=bar\" */\n    path: string\n}\n    \n";
            // Create router.ts
            fs.writeFileSync(routerEntryTSPath, script.trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function createManifest(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var startExec, manifest;
        var appName = _b.appName, version = _b.version, enclaveName = _b.enclaveName, appIdentifier = _b.appIdentifier, enclaveType = _b.enclaveType, selectedEntryPointManagement = _b.selectedEntryPointManagement;
        return __generator(this, function (_c) {
            startExec = "";
            if (enclaveType == "node") {
                startExec = "npm start";
            }
            else if (enclaveType == "golang") {
                startExec = "go run .";
            }
            else if (enclaveType == "python") {
                startExec = "uv run server.py";
            }
            manifest = "\nmanifest_version: 1\nenclave_type: ".concat(enclaveType, "\napp_version: ").concat(version, "\napp_name: ").concat(appName, "\nenclave_name: ").concat(enclaveName, "\napp_unique_identifier: \"").concat(appIdentifier, "\"\nstart_exec: \"").concat(startExec, "\"\nentry_point_management: \"").concat(selectedEntryPointManagement, "\"\nresources:\n    logos:\n        - resources/dist/img/logo.png\n    folders: []");
            if (enclaveType == "node") {
                manifest += "\n    files:\n        - index.html\n        - server.ts\n        - utils.ts\n    ";
            }
            else if (enclaveType == "golang") {
                manifest += "\n    files:\n        - index.html\n        - server.go\n        - utils.go\n        - go.mod\n        - go.sum\n    ";
            }
            else if (enclaveType == "python") {
                manifest += "\n    files:\n        - index.html\n        - server.py\n        - pyproject.toml\n        - uv.lock\n        - .python-version\n    ";
            }
            // Create MANIFEST.yaml
            fs.writeFileSync("MANIFEST.yaml", manifest.trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function getUtilsForNode(entryPoint) {
    var f = "\nexport function getEnclavePrefix(enclaveName: string): string {\n    return ".concat(entryPoint == "platform_redirect" ? '`/enclave/${enclaveName}`' : "\"\"", "\n}\n");
    return f;
}
function getUtilsForGolang(entryPoint) {
    var f = "\npackage main\n\nimport \"fmt\"\n\nfunc getEnclavePrefix(enclaveName string) string {\n\treturn ".concat(entryPoint == "platform_redirect" ? "fmt.Sprintf(\"/enclave/%s\", enclaveName)" : "\"\"", "\n}\n");
    return f;
}
function createTestServer(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var envFile;
        var enclaveType = _b.enclaveType, enclaveName = _b.enclaveName, entryPoint = _b.entryPoint;
        return __generator(this, function (_c) {
            if (enclaveType == "node") {
                fs.copyFileSync(path.join(rootFolder, "server", "node", "server.ts"), "server.ts");
                fs.writeFileSync("utils.ts", getUtilsForNode(entryPoint).trim(), { flag: "w", flush: true });
            }
            else if (enclaveType == "golang") {
                fs.copyFileSync(path.join(rootFolder, "server", "golang", "server.go"), "server.go");
                fs.writeFileSync("utils.go", getUtilsForGolang(entryPoint).trim(), { flag: "w", flush: true });
                fs.copyFileSync(path.join(rootFolder, "server", "golang", "go.mod"), "go.mod");
                fs.copyFileSync(path.join(rootFolder, "server", "golang", "go.sum"), "go.sum");
            }
            else if (enclaveType == "python") {
                fs.copyFileSync(path.join(rootFolder, "server", "python", "server.py"), "server.py");
                fs.copyFileSync(path.join(rootFolder, "server", "python", "pyproject.toml"), "pyproject.toml");
                fs.copyFileSync(path.join(rootFolder, "server", "python", "uv.lock"), "uv.lock");
                fs.copyFileSync(path.join(rootFolder, "server", "python", ".python-version"), ".python-version");
            }
            envFile = "\nENCLAVE_NAME=".concat(enclaveName, "\nSCAILO_API=http://127.0.0.1:21000\nPORT=9090\nPRODUCTION=false\nUSERNAME=\nPASSWORD=\n\n# Redis\nREDIS_USERNAME=\nREDIS_PASSWORD=\nREDIS_URL=localhost:6379\n\nWORKFLOW_EVENTS_CHANNEL=GENESIS-WORKFLOW-EVENTS\nCOOKIE_SIGNATURE_SECRET=").concat(crypto.randomBytes(32).toString('hex'));
            fs.writeFileSync(".env", envFile.trim(), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function fixTSConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var configFileName, configFileText, _a, config, error, parsedCommandLine;
        return __generator(this, function (_b) {
            configFileName = ts.findConfigFile("tsconfig.json", ts.sys.fileExists);
            if (!configFileName) {
                throw new Error("Could not find a valid tsconfig.json");
            }
            configFileText = ts.sys.readFile(configFileName);
            if (!configFileText) {
                throw new Error("Could not read file ".concat(configFileName));
            }
            _a = ts.parseConfigFileTextToJson(configFileName, configFileText), config = _a.config, error = _a.error;
            if (error) {
                throw new Error("Error parsing tsconfig.json: ".concat(error.messageText));
            }
            parsedCommandLine = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configFileName));
            parsedCommandLine.options.verbatimModuleSyntax = false;
            parsedCommandLine.options.sourceMap = false;
            parsedCommandLine.options.declaration = false;
            parsedCommandLine.options.declarationMap = false;
            fs.writeFileSync("tsconfig.json", JSON.stringify(parsedCommandLine, null, 4), { flag: "w", flush: true });
            return [2 /*return*/];
        });
    });
}
function runPostSetupScripts(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var enclaveType = _b.enclaveType;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: 
                // Run the first CSS build
                return [4 /*yield*/, spawnChildProcess("npm", ["run", "css:build"])];
                case 1:
                    // Run the first CSS build
                    _c.sent();
                    return [4 /*yield*/, spawnChildProcess("npm", ["run", "ui:build"])];
                case 2:
                    _c.sent();
                    if (!(enclaveType == "node")) return [3 /*break*/, 3];
                    return [3 /*break*/, 8];
                case 3:
                    if (!(enclaveType == "golang")) return [3 /*break*/, 6];
                    return [4 /*yield*/, spawnChildProcess("go", ["mod", "tidy"])];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, spawnChildProcess("goimports", ["-w", "."])];
                case 5:
                    _c.sent();
                    return [3 /*break*/, 8];
                case 6:
                    if (!(enclaveType == "python")) return [3 /*break*/, 8];
                    return [4 /*yield*/, spawnChildProcess("uv", ["sync", "--all-groups"])];
                case 7:
                    _c.sent();
                    _c.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Constant that stores the daisyUI plugin
 */
var daisyUiPlugin = "\n@plugin \"daisyui\" {\n    themes: light --default, dark --prefersdark;\n}";
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, appCSSPath, distFolderName, appEntryTSPath, routerEntryTSPath;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, acceptUserInputs()];
                case 1:
                    _b.sent();
                    // Create the destination folder
                    fs.mkdirSync(applicationIdentifier, { recursive: true });
                    // Copy the .vscode folder
                    fs.mkdirSync(path.join(applicationIdentifier, ".vscode"), { recursive: true });
                    fs.cpSync(path.join(rootFolder, ".vscode"), path.join(applicationIdentifier, ".vscode"), { recursive: true });
                    fs.copyFileSync(path.join(rootFolder, "README.md"), path.join(applicationIdentifier, "README.md"));
                    // Change the directory
                    process.chdir(applicationIdentifier);
                    // Create the package.json
                    return [4 /*yield*/, spawnChildProcess("npm", ["init", "-y"])];
                case 2:
                    // Create the package.json
                    _b.sent();
                    return [4 /*yield*/, setupGitIgnore()];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, setupDependencies({ enclaveType: selectedEnclaveTemplate })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, setupScripts()];
                case 5:
                    _b.sent();
                    _a = createResourcesFolders(), appCSSPath = _a.appCSSPath, distFolderName = _a.distFolderName, appEntryTSPath = _a.appEntryTSPath, routerEntryTSPath = _a.routerEntryTSPath;
                    // Create the input css
                    fs.writeFileSync(appCSSPath, ["@import \"tailwindcss\"", daisyUiPlugin].map(function (a) { return "".concat(a, ";"); }).join("\n"), { flag: "w", flush: true });
                    return [4 /*yield*/, createIndexHTML({ appName: applicationName, version: version, enclaveName: applicationIdentifier, selectedEntryPointManagement: selectedEntryPointManagement })];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, createEntryTS({ appEntryTSPath: appEntryTSPath, enclaveName: applicationIdentifier, selectedEntryPointManagement: selectedEntryPointManagement })];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, createRouterTS({ routerEntryTSPath: routerEntryTSPath })];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, createManifest({ appName: applicationName, version: version, enclaveName: applicationIdentifier, appIdentifier: "".concat(applicationIdentifier, ".enc"), enclaveType: selectedEnclaveTemplate, selectedEntryPointManagement: selectedEntryPointManagement })];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, createTestServer({ enclaveType: selectedEnclaveTemplate, enclaveName: applicationIdentifier, entryPoint: selectedEntryPointManagement })];
                case 10:
                    _b.sent();
                    return [4 /*yield*/, createBuildScripts({ appCSSPath: appCSSPath, distFolderName: distFolderName, appEntryTSPath: appEntryTSPath, enclaveType: selectedEnclaveTemplate })];
                case 11:
                    _b.sent();
                    return [4 /*yield*/, fixTSConfig()];
                case 12:
                    _b.sent();
                    return [4 /*yield*/, runPostSetupScripts({ enclaveType: selectedEnclaveTemplate })];
                case 13:
                    _b.sent();
                    console.log("Your app is ready! What are you going to build?");
                    return [2 /*return*/];
            }
        });
    });
}
main();
