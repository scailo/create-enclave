package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	"github.com/scailo/go-sdk"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/proto"

	"github.com/gorilla/securecookie"

	"github.com/joho/godotenv"
	_ "github.com/joho/godotenv/autoload"
)

// Config holds all necessary environment variables
type Config struct {
	EnclaveName string
	ScailoAPI   string
	Port        int
	Username    string
	Password    string

	RedisUsername string
	RedisPassword string
	RedisURL      string

	WorkflowEventsChannel string

	CookieSignatureSecret string
}

// Global state variables
var (
	GlobalConfig Config
	AuthToken    string
	// Use this context for all Scailo API calls
	ScailoAPICtx context.Context
	// Mutex to protect shared state
	mu            sync.RWMutex
	production    bool   = false
	indexPage     string // Cached version of index.html
	enclavePrefix string
	RedisClient   *redis.Client
)

const (
	// 12-hour interval (3600 * 12)
	loginInterval = 3600 * 12 * time.Second
	indexHTMLFile = "index.html"
)

func init() {
	// Initialize the random number generator
	// rand.Seed(time.Now().UnixNano())
}

// loadConfig reads and validates environment variables.
func loadConfig() {
	// Try loading .env
	godotenv.Load(".env")
	// We'll respect the user's `production` flag.
	if os.Getenv("PRODUCTION") == "true" {
		production = true
	} else {
		// Assume development mode by default
		production = false
	}

	// 1. Read environment variables
	GlobalConfig.EnclaveName = os.Getenv("ENCLAVE_NAME")
	GlobalConfig.ScailoAPI = os.Getenv("SCAILO_API")
	GlobalConfig.Username = os.Getenv("USERNAME")
	GlobalConfig.Password = os.Getenv("PASSWORD")

	GlobalConfig.RedisUsername = os.Getenv("REDIS_USERNAME")
	GlobalConfig.RedisPassword = os.Getenv("REDIS_PASSWORD")
	GlobalConfig.RedisURL = os.Getenv("REDIS_URL")

	GlobalConfig.WorkflowEventsChannel = os.Getenv("WORKFLOW_EVENTS_CHANNEL")
	GlobalConfig.CookieSignatureSecret = os.Getenv("COOKIE_SIGNATURE_SECRET")

	portStr := os.Getenv("PORT")
	if portStr != "" {
		p, err := strconv.Atoi(portStr)
		if err == nil {
			GlobalConfig.Port = p
		}
	}

	// 2. Validate environment variables
	var exitCode = 0
	if GlobalConfig.EnclaveName == "" {
		log.Println("ENCLAVE_NAME not set")
		exitCode = 1
	}
	if GlobalConfig.ScailoAPI == "" {
		log.Println("SCAILO_API not set")
		exitCode = 1
	}
	if GlobalConfig.Port == 0 {
		log.Println("PORT not set or is 0")
		exitCode = 1
	}
	if GlobalConfig.Username == "" {
		log.Println("USERNAME not set")
		exitCode = 1
	}
	if GlobalConfig.Password == "" {
		log.Println("PASSWORD not set")
		exitCode = 1
	}
	if GlobalConfig.RedisURL == "" {
		log.Println("REDIS_URL not set")
		exitCode = 1
	}
	if GlobalConfig.WorkflowEventsChannel == "" {
		log.Println("WORKFLOW_EVENTS_CHANNEL not set")
		exitCode = 1
	}
	if GlobalConfig.CookieSignatureSecret == "" {
		log.Println("COOKIE_SIGNATURE_SECRET not set")
		exitCode = 1
	}

	enclavePrefix = getEnclavePrefix(GlobalConfig.EnclaveName)

	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

// loginToAPI logs into the Scailo API
func loginToAPI(conn *grpc.ClientConn) {
	// This function uses a goroutine to run asynchronously and recursively.
	RedisClient = redis.NewClient(&redis.Options{
		Addr:               GlobalConfig.RedisURL,
		Password:           GlobalConfig.RedisPassword,
		MaxRetries:         5,
		DialTimeout:        10 * time.Second,
		ReadTimeout:        30 * time.Second,
		WriteTimeout:       30 * time.Second,
		PoolSize:           10,
		MinIdleConns:       5,
		PoolTimeout:        30 * time.Second,
		IdleTimeout:        15 * time.Minute,
		IdleCheckFrequency: 1 * time.Minute,
	})
	go handleWorkflowEvents(RedisClient)

	// Create a Ticker for the recurring job (1 hour)
	ticker := time.NewTicker(loginInterval)

	// Start the initial login immediately, then wait for the ticker.
	performLogin(conn)

	// Wait for the ticker events in a separate goroutine
	go func() {
		for range ticker.C {
			performLogin(conn)
		}
	}()
}

func getServerURL() string {
	if strings.HasPrefix(GlobalConfig.ScailoAPI, "http") || strings.Contains(GlobalConfig.ScailoAPI, "//") {
		var split = strings.Split(GlobalConfig.ScailoAPI, "//")
		if len(split) > 1 {
			return split[1]
		}
	}

	return GlobalConfig.ScailoAPI
}

func handleWorkflowEvents(redisClient *redis.Client) error {
	subscription := redisClient.Subscribe(GlobalConfig.WorkflowEventsChannel)
	for message := range subscription.Channel() {
		fmt.Println("Received message on workflow channel")
		var workflowEvent = new(sdk.WorkflowEvent)

		err := proto.Unmarshal([]byte(message.Payload), workflowEvent)
		if err != nil {
			fmt.Printf("Unable to unmarshal workflow event: %s\n", err.Error())
			continue
		}
		fmt.Println("Unmarshalled the message with rule code: ", workflowEvent.RuleCode, " for service: ", workflowEvent.ServiceName.String())

		// Sample code to handle a sales order related workflow rule
		if workflowEvent.RuleCode == "" {
			// Handle sales order
			var salesorder = new(sdk.SalesOrder)
			err = proto.Unmarshal(workflowEvent.TransactionPayload, salesorder)
			if err != nil {
				fmt.Println("Unable to unmarshal sales order: ", err)
				continue
			}
			fmt.Println("Unmarshalled transaction payload for rule code: ", workflowEvent.RuleCode)
			// Use the ScailoAPICtx to further process the sales order
		}
	}
	return nil
}

func getGRPCConnection() *grpc.ClientConn {
	var creds grpc.DialOption
	if strings.HasPrefix(GlobalConfig.ScailoAPI, "http://") {
		// Without TLS
		creds = grpc.WithTransportCredentials(insecure.NewCredentials())
	} else {
		// With TLS
		creds = grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(nil, getServerURL()))
	}

	// Max Message Size is 64MB
	const maxMessageSize = 64 * 1024 * 1024
	conn, err := grpc.NewClient(getServerURL(), creds, grpc.WithKeepaliveParams(keepalive.ClientParameters{
		Time:                10 * time.Second, // Ping every 10s if idle
		Timeout:             time.Second,      // Wait 1s for response
		PermitWithoutStream: true,             // Ping even if there are no active RPCs
	}), grpc.WithDefaultCallOptions(
		grpc.MaxCallRecvMsgSize(maxMessageSize),
		grpc.MaxCallSendMsgSize(maxMessageSize),
	))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	return conn
}

func performLogin(conn *grpc.ClientConn) {
	log.Println("About to login to API")

	ctx := context.Background()

	loginClient := sdk.NewLoginServiceClient(conn)
	loginResp, err := loginClient.LoginAsEmployeePrimary(ctx, &sdk.UserLoginRequest{
		Username:          GlobalConfig.Username,
		PlainTextPassword: GlobalConfig.Password,
	})
	if err != nil {
		panic(err)
	}

	md := metadata.Pairs(
		"auth_token", loginResp.AuthToken,
	)

	// 4. Create a new context with the metadata attached.
	ScailoAPICtx = metadata.NewOutgoingContext(ctx, md)

	mu.Lock()
	AuthToken = loginResp.AuthToken
	mu.Unlock()

	log.Printf("Logged in with auth token: %s", AuthToken)
}

// replaceBundleCaches implements the cache-busting logic
func replaceBundleCaches(page string) string {
	version := time.Now().Format("20060102150405") // YYYYMMDDhhmmss format

	// Replace script preload
	page = IndexPageReplacer(page,
		fmt.Sprintf(`<link rel="preload" as="script" href="%s/resources/dist/js/bundle.src.min.js">`, enclavePrefix),
		fmt.Sprintf(`<link rel="preload" as="script" href="%s/resources/dist/js/bundle.src.min.js?v=%s">`, enclavePrefix, version))

	// Replace script src
	page = IndexPageReplacer(page,
		fmt.Sprintf(`<script src="%s/resources/dist/js/bundle.src.min.js"></script>`, enclavePrefix),
		fmt.Sprintf(`<script src="%s/resources/dist/js/bundle.src.min.js?v=%s"></script>`, enclavePrefix, version))

	// Replace stylesheet link
	page = IndexPageReplacer(page,
		fmt.Sprintf(`<link rel="stylesheet" href="%s/resources/dist/css/bundle.css">`, enclavePrefix),
		fmt.Sprintf(`<link rel="stylesheet" href="%s/resources/dist/css/bundle.css?v=%s">`, enclavePrefix, version))

	return page
}

// IndexPageReplacer is a helper to centralize string replacement with logging.
func IndexPageReplacer(s, old, new string) string {
	return strings.ReplaceAll(s, old, new)
}

// indexHandler is the single handler for all root/SPA routes.
func indexHandler(c *gin.Context) {
	// 1. Read index.html logic
	if !production || indexPage == "" {
		content, err := os.ReadFile(indexHTMLFile)
		if err != nil {
			log.Printf("Error reading index.html: %v", err)
			c.String(http.StatusInternalServerError, "Index page not found.")
			return
		}
		indexPage = string(content)
	}

	// 2. Cache busting logic
	pageWithCache := replaceBundleCaches(indexPage)

	// 3. Set headers and send response
	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, pageWithCache)
}

// AuthMiddleware is our "Gatekeeper"
func AuthMiddleware(cookieCoder *securecookie.SecureCookie, cookieAuthTokenName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, err := c.Cookie(cookieAuthTokenName)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Decode the value
		var authToken string
		cookieCoder.Decode(cookieAuthTokenName, val, &authToken)

		if authToken == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Store the unsigned value in the context for the next handler
		c.Set(cookieAuthTokenName, authToken)
		c.Next()
	}
}

func getNewContextForAuthToken(authToken string) context.Context {
	ctx := context.Background()
	md := metadata.Pairs(
		"auth_token", authToken,
	)

	// 4. Create a new context with the metadata attached.
	return metadata.NewOutgoingContext(ctx, md)
}

// main entry point
func main() {
	loadConfig()

	conn := getGRPCConnection()
	defer conn.Close()

	var cookieCoder = securecookie.New([]byte(GlobalConfig.CookieSignatureSecret), nil)

	// Start the recurring login process asynchronously
	go loginToAPI(conn)

	// Set Gin to release mode if in production
	if production {
		gin.SetMode(gin.ReleaseMode)
	}

	vaultClient := sdk.NewVaultServiceClient(conn)
	purchaseOrdersClient := sdk.NewPurchasesOrdersServiceClient(conn)
	vendorsClient := sdk.NewVendorsServiceClient(conn)

	var cookieAuthTokenName = fmt.Sprintf("%s_auth_token", GlobalConfig.EnclaveName)

	// Initialize Gin
	router := gin.Default()

	// Enable gzip compression with default compression level
	router.Use(gzip.Gzip(gzip.DefaultCompression))

	// --- 1. Register Static Routes ---
	router.Static(fmt.Sprintf("%s/resources/dist", enclavePrefix), filepath.Join("resources", "dist"))

	// --- 2. Health Checks ---
	router.GET(fmt.Sprintf("%s/health/startup", enclavePrefix), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})
	router.GET(fmt.Sprintf("%s/health/liveliness", enclavePrefix), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})
	router.GET(fmt.Sprintf("%s/health/readiness", enclavePrefix), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})

	// --- 3. API Endpoint ---
	// Using a parameter for enclaveName so it matches the route pattern exactly
	router.GET(fmt.Sprintf("%s/api/random", enclavePrefix), func(c *gin.Context) {
		// Generate a random float between 0.0 and 1.0 (like Math.random())
		randomNumber := rand.Float64()
		c.JSON(http.StatusOK, gin.H{"random": randomNumber})
	})

	// --- 4. Index Page / SPA Routes (all pointing to the same handler) ---
	// Specific UI routes
	uiPath1 := fmt.Sprintf("%s/ui", enclavePrefix)
	uiPath2 := fmt.Sprintf("%s/ui/*path", enclavePrefix)

	router.GET(uiPath1, indexHandler)
	router.GET(uiPath2, indexHandler)

	// Implicit redirect for entry_point_management = direct_url
	router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/ui", enclavePrefix))
	})

	// ------------------------------------------------------------------------------------------------------------------------
	// Enclave Ingress handler
	router.GET(fmt.Sprintf("%s/ingress/:token", enclavePrefix), func(c *gin.Context) {
		var cookieToSet string
		var expiresIn int
		if !production {
			// In dev, use the default auth token
			expiresIn = 3600
			cookieToSet = AuthToken
		} else {
			token := c.Param("token")
			if token == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Missing token"})
				return
			}
			// Correctly verify the ingress token
			ingress, err := vaultClient.VerifyEnclaveIngress(ScailoAPICtx, &sdk.VerifyEnclaveIngressRequest{Token: token})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			expiresIn = int(ingress.ExpiresAt) - int(time.Now().Unix())
			cookieToSet = ingress.AuthToken

		}
		securedCookieValue, err := cookieCoder.Encode(cookieAuthTokenName, cookieToSet)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.SetCookie(cookieAuthTokenName, securedCookieValue, expiresIn, "/", "", false, true)
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/ui", enclavePrefix))
	})

	// Protected routes
	protected := router.Group(fmt.Sprintf("%s/protected", enclavePrefix))
	protected.Use(AuthMiddleware(cookieCoder, cookieAuthTokenName))
	{
		protected.GET("/api/random", func(c *gin.Context) {
			// Generate a random float between 0.0 and 1.0 (like Math.random())

			authToken, exists := c.Get(cookieAuthTokenName)
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
				return
			}

			ctx := getNewContextForAuthToken(authToken.(string))
			purchaseOrdersList, err := purchaseOrdersClient.Filter(ctx, &sdk.PurchasesOrdersServiceFilterReq{IsActive: sdk.BOOL_FILTER_BOOL_FILTER_TRUE, Count: -1})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			vendorsList, err := vendorsClient.Filter(ctx, &sdk.VendorsServiceFilterReq{IsActive: sdk.BOOL_FILTER_BOOL_FILTER_TRUE, Count: -1})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			randomNumber := rand.Float64()
			c.JSON(http.StatusOK, gin.H{"random": randomNumber, "purchaseOrders": purchaseOrdersList.List, "vendors": vendorsList.List})
		})
	}

	// ------------------------------------------------------------------------------------------------------------------------

	// --- 5. Not Found Handler ---
	router.NoRoute(func(c *gin.Context) {
		// Only redirect if the request is not for a resource that failed to load (e.g., /resources/dist/404)
		c.Redirect(http.StatusTemporaryRedirect, uiPath1)
	})

	// --- 6. Start Server ---
	address := fmt.Sprintf("0.0.0.0:%d", GlobalConfig.Port)
	log.Printf("Listening on address %s with Production: %t", address, production)

	if err := router.Run(address); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
