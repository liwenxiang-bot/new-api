package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

func TestWebIndexUsesCurrentSiteNameBeforeJavaScript(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	originalName := common.SystemName
	common.SystemName = "玖亿 API"
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.SystemName = originalName
		common.OptionMapRWMutex.Unlock()
	})

	const analytics = `<script>window.analytics = {template: '{{example}}', label: 'New API'};</script>`
	page := []byte(`<!doctype html><html><head><title>New API</title><meta name="title" content="New API" />` + analytics + `</head><body><div id="root"></div></body></html>`)
	server := gin.New()
	SetWebRouter(server, WebAssets{IndexPage: page}, func(c *gin.Context) { c.Next() })

	for _, name := range []string{"玖亿 API", `新名称 & "引号" </title><script>alert('$1')</script>`} {
		common.OptionMapRWMutex.Lock()
		common.SystemName = name
		common.OptionMapRWMutex.Unlock()
		for _, path := range []string{"/", "/?source=wechat", "/invoices", "/index.html?source=wechat"} {
			t.Run(name+path, func(t *testing.T) {
				response := httptest.NewRecorder()
				server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
				require.Equal(t, http.StatusOK, response.Code)
				assert.Equal(t, "no-cache", response.Header().Get("Cache-Control"))
				assert.Contains(t, response.Header().Get("Content-Type"), "text/html")
				assert.Contains(t, response.Body.String(), analytics)
				document, err := html.Parse(strings.NewReader(response.Body.String()))
				require.NoError(t, err)
				var titles []string
				metadata := map[string]string{}
				var scripts int
				var visit func(*html.Node)
				visit = func(node *html.Node) {
					if node.Type == html.ElementNode {
						switch node.Data {
						case "title":
							require.NotNil(t, node.FirstChild)
							titles = append(titles, node.FirstChild.Data)
						case "script":
							scripts++
						case "meta":
							var key, content string
							for _, attr := range node.Attr {
								if attr.Key == "name" {
									key = attr.Val
								}
								if attr.Key == "content" {
									content = attr.Val
								}
							}
							metadata[key] = content
						}
					}
					for child := node.FirstChild; child != nil; child = child.NextSibling {
						visit(child)
					}
				}
				visit(document)
				assert.Equal(t, []string{name}, titles)
				assert.Equal(t, name, metadata["title"])
				assert.Equal(t, name, metadata["application-name"])
				assert.Equal(t, 1, scripts, "site names must not inject executable HTML")
			})
		}
	}
}
