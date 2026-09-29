package controller

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const invoiceJSONLimit = 32 << 10

func invoiceError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	key := i18n.MsgInvoiceFailed
	switch {
	case errors.Is(err, model.ErrInvoiceBelowMinimum):
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"code":    "INVOICE_BELOW_MINIMUM",
			"message": common.TranslateMessage(c, i18n.MsgInvoiceBelowMinimum),
		})
		return
	case errors.Is(err, model.ErrInvoiceInvalidInput):
		status, key = http.StatusBadRequest, i18n.MsgInvoiceInvalidInput
	case errors.Is(err, model.ErrInvoiceIneligible):
		status, key = http.StatusBadRequest, i18n.MsgInvoiceIneligible
	case errors.Is(err, model.ErrInvoiceNotFound):
		status, key = http.StatusNotFound, i18n.MsgInvoiceNotFound
	case errors.Is(err, model.ErrInvoiceConflict):
		status, key = http.StatusConflict, i18n.MsgInvoiceConflict
	default:
		// Do not include invoice details, bank information, or document content.
		common.SysError("invoice operation failed")
	}
	c.JSON(status, gin.H{"success": false, "message": common.TranslateMessage(c, key)})
}

func invoicePage(c *gin.Context) *common.PageInfo {
	page := common.GetPageQuery(c)
	page.Page = max(1, min(page.Page, 100000))
	page.PageSize = max(1, min(page.PageSize, 100))
	return page
}

func invoiceID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		invoiceError(c, model.ErrInvoiceNotFound)
		return 0, false
	}
	return id, true
}

func decodeInvoiceRequest(c *gin.Context, input any) bool {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"success": false, "message": common.TranslateMessage(c, i18n.MsgInvoiceInvalidInput)})
		return false
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, invoiceJSONLimit))
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": common.TranslateMessage(c, i18n.MsgInvoiceRequestTooLarge)})
		return false
	}
	if err := common.Unmarshal(body, input); err != nil {
		invoiceError(c, model.ErrInvoiceInvalidInput)
		return false
	}
	return true
}

func GetInvoiceEligibleTopUps(c *gin.Context) {
	if !requireInvoiceApplicationsEnabled(c) {
		return
	}
	page := invoicePage(c)
	items, total, err := model.ListInvoiceEligibleTopUps(c.GetInt("id"), page)
	if err != nil {
		invoiceError(c, err)
		return
	}
	page.SetItems(items)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}

func CreateInvoice(c *gin.Context) {
	if !requireInvoiceApplicationsEnabled(c) {
		return
	}
	var input model.InvoiceApplicationRequest
	if !decodeInvoiceRequest(c, &input) {
		return
	}
	invoice, err := model.CreateInvoiceApplication(c.GetInt("id"), input)
	if err != nil {
		invoiceError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func requireInvoiceApplicationsEnabled(c *gin.Context) bool {
	if operation_setting.IsInvoiceEnabled() {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"code":    "INVOICE_DISABLED",
		"message": common.TranslateMessage(c, i18n.MsgInvoiceDisabled),
	})
	return false
}

func GetUserInvoices(c *gin.Context) {
	listInvoices(c, false)
}

func GetAdminInvoices(c *gin.Context) {
	listInvoices(c, true)
}

func listInvoices(c *gin.Context, admin bool) {
	page := invoicePage(c)
	items, total, err := model.ListInvoices(c.GetInt("id"), admin, c.Query("status"), page)
	if err != nil {
		invoiceError(c, err)
		return
	}
	page.SetItems(items)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}

func GetUserInvoice(c *gin.Context) {
	getInvoice(c, false)
}

func GetAdminInvoice(c *gin.Context) {
	getInvoice(c, true)
}

func getInvoice(c *gin.Context, admin bool) {
	id, ok := invoiceID(c)
	if !ok {
		return
	}
	invoice, err := model.GetInvoice(id, c.GetInt("id"), admin)
	if err != nil {
		invoiceError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func ReviewInvoice(c *gin.Context) {
	id, ok := invoiceID(c)
	if !ok {
		return
	}
	var input struct {
		Approve *bool  `json:"approve"`
		Reason  string `json:"reason"`
	}
	if !decodeInvoiceRequest(c, &input) {
		return
	}
	if input.Approve == nil {
		invoiceError(c, model.ErrInvoiceInvalidInput)
		return
	}
	invoice, err := model.ReviewInvoice(id, c.GetInt("id"), *input.Approve, input.Reason)
	if err != nil {
		invoiceError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func IssueInvoice(c *gin.Context) {
	id, ok := invoiceID(c)
	if !ok {
		return
	}
	// Bound the entire multipart body before parsing, including all fields and
	// parts. The PDF itself is separately bounded by the domain layer.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, model.InvoiceMaxFileSize+(64<<10))
	err := c.Request.ParseMultipartForm(model.InvoiceMaxFileSize + (64 << 10))
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	if err != nil {
		var sizeErr *http.MaxBytesError
		if errors.As(err, &sizeErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": common.TranslateMessage(c, i18n.MsgInvoiceFileTooLarge)})
			return
		}
		invoiceError(c, model.ErrInvoiceInvalidInput)
		return
	}
	form := c.Request.MultipartForm
	if form == nil || len(form.File) != 1 || len(form.File["file"]) != 1 || len(form.Value["invoice_number"]) != 1 {
		invoiceError(c, model.ErrInvoiceInvalidInput)
		return
	}
	header := form.File["file"][0]
	if header.Size > model.InvoiceMaxFileSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": common.TranslateMessage(c, i18n.MsgInvoiceFileTooLarge)})
		return
	}
	file, err := header.Open()
	if err != nil {
		invoiceError(c, err)
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, model.InvoiceMaxFileSize+1))
	if err != nil {
		invoiceError(c, err)
		return
	}
	invoice, err := model.IssueInvoice(id, c.GetInt("id"), form.Value["invoice_number"][0], header.Filename, content)
	if err != nil {
		invoiceError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func DownloadUserInvoice(c *gin.Context) {
	downloadInvoice(c, false)
}

func DownloadAdminInvoice(c *gin.Context) {
	downloadInvoice(c, true)
}

func downloadInvoice(c *gin.Context, admin bool) {
	id, ok := invoiceID(c)
	if !ok {
		return
	}
	file, err := model.GetInvoiceFile(id, c.GetInt("id"), admin)
	if err != nil {
		invoiceError(c, err)
		return
	}
	// Never render uploaded documents inline or expose their original names as
	// paths. Access is checked on every download, including administrator reads.
	c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": fmt.Sprintf("invoice-%d.pdf", id)}))
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Data(http.StatusOK, "application/pdf", file.Content)
}
