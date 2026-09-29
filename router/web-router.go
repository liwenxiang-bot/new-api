package router

import (
	"bytes"
	"embed"
	"html"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	nethtml "golang.org/x/net/html"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	serveStatic := static.Serve("/", frontendFS)

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.AccessTokenAudit(),
		middleware.GlobalWebRateLimit(),
		middleware.Cache(),
		func(c *gin.Context) {
			// Serve every entry URL through the current site configuration, including
			// index.html, which the static file server otherwise handles itself.
			pagePath := path.Clean(c.Request.URL.Path)
			if pagePath != "/" && pagePath != "/index.html" {
				serveStatic(c)
			}
		},
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			common.OptionMapRWMutex.RLock()
			systemName := common.SystemName
			common.OptionMapRWMutex.RUnlock()
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", renderWebIndex(assets.IndexPage, systemName))
		},
	)
}

// renderWebIndex sends the configured name before JavaScript or cached status
// can run. Preserve the original bytes of assets and injected analytics scripts.
func renderWebIndex(indexPage []byte, systemName string) []byte {
	name := html.EscapeString(systemName)
	var page bytes.Buffer
	page.Grow(len(indexPage) + len(name)*3)
	tokens := nethtml.NewTokenizer(bytes.NewReader(indexPage))
	insideTitle := false
	for {
		kind := tokens.Next()
		if kind == nethtml.ErrorToken {
			return page.Bytes()
		}
		raw := string(tokens.Raw())
		if insideTitle {
			if kind == nethtml.EndTagToken && tokens.Token().Data == "title" {
				insideTitle = false
			}
			continue
		}
		if kind == nethtml.StartTagToken || kind == nethtml.SelfClosingTagToken {
			token := tokens.Token()
			if token.Data == "title" {
				page.WriteString(`<title>` + name + `</title><meta name="application-name" content="` + name + `">`)
				insideTitle = true
				continue
			}
			if token.Data == "meta" {
				isTitle := false
				for _, attr := range token.Attr {
					if attr.Key == "name" && attr.Val == "title" {
						isTitle = true
						break
					}
				}
				if isTitle {
					page.WriteString(`<meta name="title" content="` + name + `">`)
					continue
				}
			}
		}
		page.WriteString(raw)
	}
}
