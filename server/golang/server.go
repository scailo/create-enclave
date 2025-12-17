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

	"github.com/gin-gonic/gin"
	"github.com/scailo/go-sdk"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

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
)

const (
	// 1-hour interval (3600)
	loginInterval = 3600 * time.Second
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
	if os.Getenv("GIN_MODE") == "release" {
		production = true
	} else if os.Getenv("PRODUCTION") == "true" {
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

	portStr := os.Getenv("PORT")
	if portStr != "" {
		p, err := strconv.Atoi(portStr)
		if err == nil {
			GlobalConfig.Port = p
		}
	}

	// 2. Validate environment variables (matches Node.js exit logic)
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

	enclavePrefix = fmt.Sprintf("/enclave/%s", GlobalConfig.EnclaveName)

	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

// loginToAPI logs into the Scailo API
func loginToAPI() {
	// This function uses a goroutine to run asynchronously and recursively.

	// Create a Ticker for the recurring job (1 hour)
	ticker := time.NewTicker(loginInterval)

	// Start the initial login immediately, then wait for the ticker.
	performLogin()

	// Wait for the ticker events in a separate goroutine
	go func() {
		for range ticker.C {
			performLogin()
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

func performLogin() {
	log.Println("About to login to API")

	var creds grpc.DialOption
	if strings.HasPrefix(GlobalConfig.ScailoAPI, "http://") {
		// Without TLS
		creds = grpc.WithTransportCredentials(insecure.NewCredentials())
	} else {
		// With TLS
		creds = grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(nil, getServerURL()))
	}

	conn, err := grpc.NewClient(getServerURL(), creds)
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

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

// main entry point
func main() {
	loadConfig()

	// Start the recurring login process asynchronously
	go loginToAPI()

	// Set Gin to release mode if in production
	if production {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Gin
	router := gin.Default()

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
