import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";
import { createConnectTransport } from "@connectrpc/connect-node";
import { BOOL_FILTER, getScailoClientForLoginService, getScailoClientForPurchasesOrdersService, getScailoClientForVaultService, getScailoClientForVendorsService, WorkflowEvent } from "@kernelminds/scailo-sdk";
import { createClient } from "redis";
import type { FastifyCookieOptions } from "@fastify/cookie";
import cookie from "@fastify/cookie";
import { getEnclavePrefix } from "./utils";

const ENCLAVE_NAME = (process.env.ENCLAVE_NAME || "").trim();
const SCAILO_API = (process.env.SCAILO_API || "").trim();
const PORT = parseInt(process.env.PORT || "0");
const USERNAME = (process.env.USERNAME || "").trim();
const PASSWORD = (process.env.PASSWORD || "").trim();
const REDIS_USERNAME = (process.env.REDIS_USERNAME || "").trim();
const REDIS_PASSWORD = (process.env.REDIS_PASSWORD || "").trim();
const REDIS_URL = (process.env.REDIS_URL || "").trim();
const WORKFLOW_EVENTS_CHANNEL = (process.env.WORKFLOW_EVENTS_CHANNEL || "").trim();
/**If this has to be a constant, this can be overridden by creating an environment variable */
const COOKIE_SIGNATURE_SECRET = (process.env.COOKIE_SIGNATURE_SECRET || "").trim();

if (ENCLAVE_NAME == undefined || ENCLAVE_NAME == null || ENCLAVE_NAME == "") {
    console.log("ENCLAVE_NAME not set");
    process.exit(1);
}

if (SCAILO_API == undefined || SCAILO_API == null || SCAILO_API == "") {
    console.log("SCAILO_API not set");
    process.exit(1);
}

if (PORT == undefined || PORT == null || PORT == 0) {
    console.log("PORT not set");
    process.exit(1);
}

if (USERNAME == undefined || USERNAME == null || USERNAME == "") {
    console.log("USERNAME not set");
    process.exit(1);
}

if (PASSWORD == undefined || PASSWORD == null || PASSWORD == "") {
    console.log("PASSWORD not set");
    process.exit(1);
}

if (REDIS_URL == undefined || REDIS_URL == null || REDIS_URL == "") {
    console.log("REDIS_URL not set");
    process.exit(1);
}

if (WORKFLOW_EVENTS_CHANNEL == undefined || WORKFLOW_EVENTS_CHANNEL == null || WORKFLOW_EVENTS_CHANNEL == "") {
    console.log("WORKFLOW_EVENTS_CHANNEL not set");
    process.exit(1);
}

if (COOKIE_SIGNATURE_SECRET == undefined || COOKIE_SIGNATURE_SECRET == null || COOKIE_SIGNATURE_SECRET == "") {
    console.log("COOKIE_SIGNATURE_SECRET not set");
    process.exit(1);
}

const redisConnectionString = `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_URL}`;

async function setupWorkflowEventsCapture() {
    const client = await createClient({ url: redisConnectionString })
        .on('error', err => server.log.info('Redis Client Error', err))
        .connect();
    client.subscribe(WORKFLOW_EVENTS_CHANNEL, (incomingMessage) => {
        const message = JSON.parse(incomingMessage) as WorkflowEvent;
        console.log("Received Workflow Event: " + JSON.stringify(message));
    });
}

function getTransport(apiEndPoint: string) {
    return createConnectTransport({
        baseUrl: apiEndPoint, httpVersion: "1.1", useBinaryFormat: false, interceptors: []
    });
}

const transport = getTransport(SCAILO_API);
const server = Fastify({
    trustProxy: true,
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty'
        }
    }
});
const loginClient = getScailoClientForLoginService(transport);
const vaultClient = getScailoClientForVaultService(transport);
const purchaseOrdersClient = getScailoClientForPurchasesOrdersService(transport);
const vendorsClient = getScailoClientForVendorsService(transport);

let authToken = "";
let production = false;
if (process.env.PRODUCTION && process.env.PRODUCTION == "true") {
    production = true;
}

const enclavePrefix = getEnclavePrefix(ENCLAVE_NAME);

async function loginToAPI() {
    console.log("About to login to API")
    try {
        loginClient.loginAsEmployeePrimary({ username: USERNAME, plainTextPassword: PASSWORD }).then(response => {
            authToken = response.authToken;
            console.log("Logged in with auth token: " + authToken);
        });
    } catch (e) {
        console.error(e);
    } finally {
        setTimeout(() => {
            loginToAPI();
        }, 3600 * 1000);
    }
}

/**Register the cookie plugin */
server.register(cookie, {
    secret: COOKIE_SIGNATURE_SECRET, // for cookies signature
    parseOptions: {}     // options for parsing cookies
} as FastifyCookieOptions)

// ------------------------------------------------------------------------------------------
// Register static routes here (this will serve the correct favicon from any route)
server.register(require('fastify-favicon'), { path: `./resources/dist/img`, name: 'favicon.ico', maxAge: 3600 })
// Setup static handler for web/
server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'resources', 'dist'),
    prefix: `${enclavePrefix}/resources/dist`, // optional: default '/'
    decorateReply: false,
    constraints: {} // optional: default {}
});

let indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
server.get("/*", async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

// Implicit redirect for entry_point_management = direct_url
server.get(`/`, async (request, reply) => {
    reply.redirect(`${enclavePrefix}/ui`);
});

server.get(`${enclavePrefix}/ui`, async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

server.get(`${enclavePrefix}/ui/*`, async (request, reply) => {
    if (!production) {
        indexPage = fs.readFileSync(path.join(process.cwd(), 'index.html'), { encoding: 'utf-8' });
    }
    reply.header("Content-Type", "text/html");
    reply.send(replaceBundleCaches(indexPage));
});

function appendDefaultHeader({ authTokenToAdd }: { authTokenToAdd?: string }) {
    if (!authTokenToAdd) {
        authTokenToAdd = authToken;
    }
    return {
        "auth_token": authTokenToAdd
    }
}

/**Handle the ingress -> sets the auth token and redirects to the entry point */
server.get(`${enclavePrefix}/ingress/:token`, async (request, reply) => {
    try {
        if (!production) {
            // In dev, use the default auth token
            reply.setCookie(`${ENCLAVE_NAME}_auth_token`, authToken, {
                path: "/",
                signed: true,
                expires: new Date(Date.now() + 3600 * 1000)
            });
        } else {
            const token = (<any>request.params).token;
            if (!token) {
                reply.status(400).send("Missing token");
                return;
            }
            // Correctly verify the ingress token
            const ingress = await vaultClient.verifyEnclaveIngress({ token }, { headers: appendDefaultHeader({ authTokenToAdd: authToken }) });
            reply.setCookie(`${ENCLAVE_NAME}_auth_token`, ingress.authToken, {
                path: "/",
                signed: true,
                expires: new Date(parseInt(ingress.expiresAt.toString()) * 1000)
            });
        }

        reply.redirect(`${enclavePrefix}/ui`);
    } catch (e) {
        reply.code(500).send(e);
    }
});

/**Handles the protected routes -> verifies the auth token and calls the handler */
async function handleProtectedRoute(request: FastifyRequest, reply: FastifyReply, handler: (userAuthToken: string) => void) {
    try {
        let cookieValue = request.cookies[`${ENCLAVE_NAME}_auth_token`];
        if (!cookieValue || cookieValue == "") {
            server.log.error("No auth token found");
            reply.redirect(`${enclavePrefix}/ui`);
        }
        const userAuthToken = request.unsignCookie(cookieValue!).value;
        if (!userAuthToken || userAuthToken == "") {
            server.log.error("No auth token found");
            reply.redirect(`${enclavePrefix}/ui`);
        }

        handler(userAuthToken!);
    } catch (e) {
        reply.code(500).send(e);
    }
}

server.get(`${enclavePrefix}/protected/api/random`, async (request, reply) => {
    handleProtectedRoute(request, reply, async (userAuthToken) => {
        const [purchaseOrdersList, vendorsList] = await Promise.all([
            purchaseOrdersClient.filter({
                isActive: BOOL_FILTER.BOOL_FILTER_TRUE,
                count: BigInt(5),
            }, { headers: appendDefaultHeader({ authTokenToAdd: userAuthToken! }) }),

            vendorsClient.filter({
                isActive: BOOL_FILTER.BOOL_FILTER_TRUE,
                count: BigInt(5),
            }, { headers: appendDefaultHeader({ authTokenToAdd: userAuthToken! }) })
        ]);

        reply.send({ random: Math.random(), purchaseOrders: purchaseOrdersList.list, vendors: vendorsList.list });
    });
})

server.get(`${enclavePrefix}/api/random`, async (request, reply) => {
    reply.header("Content-Type", "application/json");
    reply.send({ random: Math.random() });
});

server.get(`${enclavePrefix}/health/startup`, async (request, reply) => {
    reply.send({ status: "OK" });
});

server.get(`${enclavePrefix}/health/liveliness`, async (request, reply) => {
    reply.send({ status: "OK" });
});

server.get(`${enclavePrefix}/health/readiness`, async (request, reply) => {
    reply.send({ status: "OK" });
});

function replaceBundleCaches(page: string) {
    const version = new Date().toISOString();
    page = page.replace(`<link rel="preload" as="script" href="${enclavePrefix}/resources/dist/js/bundle.src.min.js">`, `<link rel="preload" as="script" href="${enclavePrefix}/resources/dist/js/bundle.src.min.js?v=${version}">`)
    page = page.replace(`<script src="${enclavePrefix}/resources/dist/js/bundle.src.min.js"></script>`, `<script src="${enclavePrefix}/resources/dist/js/bundle.src.min.js?v=${version}"></script>`)
    page = page.replace(`<link rel="stylesheet" href="${enclavePrefix}/resources/dist/css/bundle.css">`, `<link rel="stylesheet" href="${enclavePrefix}/resources/dist/css/bundle.css?v=${version}">`)
    return page
}

// ------------------------------------------------------------------------------------------
server.setNotFoundHandler((request, reply) => {
    reply.redirect("/");
})
// ------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------
setupWorkflowEventsCapture();
console.log(`Listening on port ${PORT} with Production: ${production}`);
loginToAPI();
server.listen({ port: PORT, host: '0.0.0.0' });
