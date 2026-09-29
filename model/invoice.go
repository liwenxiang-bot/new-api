package model

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"net/mail"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const (
	InvoiceStatusPending        = "pending"
	InvoiceStatusApproved       = "approved"
	InvoiceStatusRejected       = "rejected"
	InvoiceStatusIssued         = "issued"
	InvoiceMaxFileSize          = 5 * 1024 * 1024
	InvoiceMaxAmountMinor int64 = 1_000_000_000_000
)

var (
	ErrInvoiceInvalidInput = errors.New("invalid invoice input")
	ErrInvoiceNotFound     = errors.New("invoice not found")
	ErrInvoiceConflict     = errors.New("invoice state conflict")
	ErrInvoiceIneligible   = errors.New("invoice order is not eligible")
	ErrInvoiceBelowMinimum = errors.New("invoice amount is below the minimum")
)

type InvoiceDetails struct {
	InvoiceType string `json:"invoice_type" gorm:"size:16;not null"`
	TitleType   string `json:"title_type" gorm:"size:16;not null"`
	Title       string `json:"title" gorm:"size:200;not null"`
	TaxID       string `json:"tax_id" gorm:"size:32;not null"`
	Email       string `json:"email" gorm:"size:254;not null"`
	Address     string `json:"address" gorm:"size:500;not null"`
	Phone       string `json:"phone" gorm:"size:50;not null"`
	BankName    string `json:"bank_name" gorm:"size:200;not null"`
	BankAccount string `json:"bank_account" gorm:"size:100;not null"`
	Remark      string `json:"remark" gorm:"size:1000;not null"`
}

type InvoiceApplicationRequest struct {
	TopUpIDs []int `json:"top_up_ids"`
	InvoiceDetails
}

type Invoice struct {
	Id     int    `json:"id"`
	UserID int    `json:"user_id" gorm:"not null;index:idx_invoices_user_created,priority:1"`
	Status string `json:"status" gorm:"size:16;not null;index"`
	InvoiceDetails
	AmountMinor     int64          `json:"amount_minor" gorm:"not null"`
	Currency        string         `json:"currency" gorm:"size:3;not null"`
	RejectionReason string         `json:"rejection_reason" gorm:"size:1000;not null"`
	ReviewedBy      int            `json:"reviewed_by"`
	ReviewedAt      int64          `json:"reviewed_at"`
	IssuedBy        int            `json:"issued_by"`
	IssuedAt        int64          `json:"issued_at"`
	CreatedAt       int64          `json:"created_at" gorm:"not null;index:idx_invoices_user_created,priority:2"`
	UpdatedAt       int64          `json:"updated_at" gorm:"not null"`
	InvoiceNumber   string         `json:"invoice_number" gorm:"size:100;not null"`
	FileName        string         `json:"file_name" gorm:"size:255;not null"`
	FileSize        int            `json:"file_size"`
	Orders          []InvoiceOrder `json:"orders,omitempty" gorm:"-"`
}

// InvoiceOrder retains the exact application snapshot, including for rejected
// applications. The separate reservation table enforces at most one active
// application for an order without deleting this history on rejection.
type InvoiceOrder struct {
	Id              int    `json:"id"`
	InvoiceID       int    `json:"invoice_id" gorm:"not null;uniqueIndex:idx_invoice_order,priority:1"`
	TopUpID         int    `json:"top_up_id" gorm:"not null;uniqueIndex:idx_invoice_order,priority:2"`
	TradeNo         string `json:"trade_no" gorm:"size:255;not null"`
	PaymentMethod   string `json:"payment_method" gorm:"size:50;not null"`
	PaymentProvider string `json:"payment_provider" gorm:"size:50;not null"`
	AmountMinor     int64  `json:"amount_minor" gorm:"not null"`
	Currency        string `json:"currency" gorm:"size:3;not null"`
	PaidAt          int64  `json:"paid_at" gorm:"not null"`
}

type InvoiceOrderReservation struct {
	TopUpID   int `gorm:"primaryKey;autoIncrement:false"`
	InvoiceID int `gorm:"not null;index"`
}

// InvoiceDocument stores bounded attachments in the primary database so an
// authenticated download works from every application replica. MySQL's plain
// BLOB is only 64 KiB; MEDIUMBLOB accommodates the 5 MiB upload limit.
type InvoiceDocument []byte

func (InvoiceDocument) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	switch db.Dialector.Name() {
	case string(common.DatabaseTypeMySQL):
		return "mediumblob"
	case string(common.DatabaseTypePostgreSQL):
		return "bytea"
	default:
		return "blob"
	}
}

type InvoiceFile struct {
	InvoiceID int             `json:"invoice_id" gorm:"primaryKey;autoIncrement:false"`
	FileName  string          `json:"file_name" gorm:"size:255;not null"`
	Content   InvoiceDocument `json:"-" gorm:"not null"`
}

func (input *InvoiceApplicationRequest) Validate() error {
	if len(input.TopUpIDs) < 1 || len(input.TopUpIDs) > 100 {
		return fmt.Errorf("%w: select between 1 and 100 orders", ErrInvoiceInvalidInput)
	}
	seen := make(map[int]bool, len(input.TopUpIDs))
	for _, id := range input.TopUpIDs {
		if id <= 0 || seen[id] {
			return fmt.Errorf("%w: order IDs must be positive and unique", ErrInvoiceInvalidInput)
		}
		seen[id] = true
	}
	for _, field := range []struct {
		value *string
		limit int
	}{
		{&input.Title, 200}, {&input.TaxID, 32}, {&input.Email, 254},
		{&input.Address, 500}, {&input.Phone, 50}, {&input.BankName, 200},
		{&input.BankAccount, 100}, {&input.Remark, 1000},
	} {
		*field.value = strings.TrimSpace(*field.value)
		if !utf8.ValidString(*field.value) || utf8.RuneCountInString(*field.value) > field.limit {
			return fmt.Errorf("%w: invoice details exceed the field length limit", ErrInvoiceInvalidInput)
		}
		for _, character := range *field.value {
			if unicode.IsControl(character) && !(field.value == &input.Remark && (character == '\n' || character == '\t')) {
				return fmt.Errorf("%w: invoice details contain control characters", ErrInvoiceInvalidInput)
			}
		}
	}
	if input.Title == "" || input.InvoiceType != "ordinary" || (input.TitleType != "personal" && input.TitleType != "company") {
		return fmt.Errorf("%w: invoice type and title are required", ErrInvoiceInvalidInput)
	}
	if input.TitleType == "personal" {
		if input.TaxID != "" {
			return fmt.Errorf("%w: a personal title requires an ordinary invoice without a company tax ID", ErrInvoiceInvalidInput)
		}
	} else {
		input.TaxID = strings.ToUpper(input.TaxID)
		if len(input.TaxID) < 15 || len(input.TaxID) > 20 {
			return fmt.Errorf("%w: a company tax ID must contain 15 to 20 letters or digits", ErrInvoiceInvalidInput)
		}
		for _, character := range input.TaxID {
			if (character < 'A' || character > 'Z') && (character < '0' || character > '9') {
				return fmt.Errorf("%w: invalid company tax ID", ErrInvoiceInvalidInput)
			}
		}
	}
	address, err := mail.ParseAddress(input.Email)
	if err != nil || address.Address != input.Email || address.Name != "" || !strings.Contains(input.Email, ".") {
		return fmt.Errorf("%w: provide a valid email address", ErrInvoiceInvalidInput)
	}
	return nil
}

// invoiceOrderSnapshot only accepts Epay wallet orders. TopUp.Money does not
// have one universal meaning: Stripe stores credited quota units there, while
// other providers omit the historical currency. Never reinterpret these rows
// using today's exchange rate or payment configuration.
func invoiceOrderSnapshot(topUp TopUp) (InvoiceOrder, error) {
	if topUp.Id <= 0 || topUp.Amount <= 0 || topUp.Status != common.TopUpStatusSuccess ||
		topUp.PaymentProvider != PaymentProviderEpay || topUp.PaymentMethod == PaymentMethodBalance ||
		topUp.CompleteTime <= 0 || math.IsNaN(topUp.Money) || math.IsInf(topUp.Money, 0) || topUp.Money <= 0 {
		return InvoiceOrder{}, ErrInvoiceIneligible
	}
	// Epay receives FormatFloat(..., 'f', 2, 64); reproduce exactly that paid
	// amount, including floating-point ties, rather than rounding quota units.
	paid, err := decimal.NewFromString(strconv.FormatFloat(topUp.Money, 'f', 2, 64))
	if err != nil {
		return InvoiceOrder{}, ErrInvoiceIneligible
	}
	minor := paid.Shift(2)
	if minor.LessThanOrEqual(decimal.Zero) || minor.GreaterThan(decimal.NewFromInt(InvoiceMaxAmountMinor)) {
		return InvoiceOrder{}, ErrInvoiceIneligible
	}
	return InvoiceOrder{
		TopUpID: topUp.Id, TradeNo: topUp.TradeNo, PaymentMethod: topUp.PaymentMethod,
		PaymentProvider: topUp.PaymentProvider, AmountMinor: minor.IntPart(), Currency: "CNY", PaidAt: topUp.CompleteTime,
	}, nil
}

func invoicePageOffset(page *common.PageInfo) (int, error) {
	if page == nil || page.Page < 1 || page.PageSize < 1 || page.PageSize > 100 || page.Page > math.MaxInt/page.PageSize {
		return 0, ErrInvoiceInvalidInput
	}
	return (page.Page - 1) * page.PageSize, nil
}

func ListInvoiceEligibleTopUps(userID int, page *common.PageInfo) ([]InvoiceOrder, int64, error) {
	offset, err := invoicePageOffset(page)
	if err != nil || userID <= 0 {
		return nil, 0, ErrInvoiceInvalidInput
	}
	reservations := DB.Model(&InvoiceOrderReservation{}).Select("top_up_id")
	query := DB.Model(&TopUp{}).Where(
		"user_id = ? AND status = ? AND payment_provider = ? AND payment_method <> ? AND amount > 0 AND money >= ? AND money <= ? AND complete_time > 0",
		userID, common.TopUpStatusSuccess, PaymentProviderEpay, PaymentMethodBalance, 0.005, float64(InvoiceMaxAmountMinor)/100,
	).Where("id NOT IN (?)", reservations)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var topUps []TopUp
	if err := query.Order("id DESC").Offset(offset).Limit(page.PageSize).Find(&topUps).Error; err != nil {
		return nil, 0, err
	}
	orders := make([]InvoiceOrder, 0, len(topUps))
	for _, topUp := range topUps {
		order, err := invoiceOrderSnapshot(topUp)
		if err != nil {
			continue
		}
		orders = append(orders, order)
	}
	return orders, total, nil
}

func CreateInvoiceApplication(userID int, input InvoiceApplicationRequest) (*Invoice, error) {
	minimumAmount := operation_setting.InvoiceSettingsSnapshot().MinAmountMinor
	if userID <= 0 {
		return nil, ErrInvoiceInvalidInput
	}
	if err := input.Validate(); err != nil {
		return nil, err
	}
	ids := slices.Clone(input.TopUpIDs)
	slices.Sort(ids)
	invoice := &Invoice{UserID: userID, InvoiceDetails: input.InvoiceDetails, Status: InvoiceStatusPending, Currency: "CNY"}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var topUps []TopUp
		if err := lockForUpdate(tx).Where("id IN ? AND user_id = ?", ids, userID).Order("id").Find(&topUps).Error; err != nil {
			return err
		}
		if len(topUps) != len(ids) {
			return ErrInvoiceIneligible
		}
		var reserved int64
		if err := tx.Model(&InvoiceOrderReservation{}).Where("top_up_id IN ?", ids).Count(&reserved).Error; err != nil {
			return err
		}
		if reserved != 0 {
			return ErrInvoiceConflict
		}
		invoice.Orders = make([]InvoiceOrder, 0, len(topUps))
		for _, topUp := range topUps {
			order, err := invoiceOrderSnapshot(topUp)
			if err != nil {
				return err
			}
			if invoice.AmountMinor > InvoiceMaxAmountMinor-order.AmountMinor {
				return fmt.Errorf("%w: combined invoice amount exceeds the supported limit", ErrInvoiceInvalidInput)
			}
			invoice.AmountMinor += order.AmountMinor
			invoice.Orders = append(invoice.Orders, order)
		}
		if invoice.AmountMinor < minimumAmount {
			return ErrInvoiceBelowMinimum
		}
		now := common.GetTimestamp()
		invoice.CreatedAt, invoice.UpdatedAt = now, now
		if err := tx.Create(invoice).Error; err != nil {
			return err
		}
		reservations := make([]InvoiceOrderReservation, 0, len(invoice.Orders))
		for i := range invoice.Orders {
			invoice.Orders[i].InvoiceID = invoice.Id
			reservations = append(reservations, InvoiceOrderReservation{TopUpID: invoice.Orders[i].TopUpID, InvoiceID: invoice.Id})
		}
		if err := tx.Create(&reservations).Error; err != nil {
			return err
		}
		return tx.Create(&invoice.Orders).Error
	})
	if err != nil {
		return nil, err
	}
	return invoice, nil
}

func ListInvoices(userID int, admin bool, status string, page *common.PageInfo) ([]Invoice, int64, error) {
	offset, err := invoicePageOffset(page)
	if err != nil || userID <= 0 {
		return nil, 0, ErrInvoiceInvalidInput
	}
	query := DB.Model(&Invoice{})
	if !admin {
		query = query.Where("user_id = ?", userID)
	}
	if status != "" {
		if !slices.Contains([]string{InvoiceStatusPending, InvoiceStatusApproved, InvoiceStatusRejected, InvoiceStatusIssued}, status) {
			return nil, 0, ErrInvoiceInvalidInput
		}
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]Invoice, 0)
	err = query.Order("id DESC").Offset(offset).Limit(page.PageSize).Find(&items).Error
	return items, total, err
}

func GetInvoice(id, userID int, admin bool) (*Invoice, error) {
	if id <= 0 || userID <= 0 {
		return nil, ErrInvoiceInvalidInput
	}
	query := DB.Where("id = ?", id)
	if !admin {
		query = query.Where("user_id = ?", userID)
	}
	var invoice Invoice
	if err := query.First(&invoice).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	if err := DB.Where("invoice_id = ?", id).Order("id").Find(&invoice.Orders).Error; err != nil {
		return nil, err
	}
	return &invoice, nil
}

func ReviewInvoice(id, adminID int, approve bool, reason string) (*Invoice, error) {
	reason = strings.TrimSpace(reason)
	if id <= 0 || adminID <= 0 || (!approve && reason == "") || !utf8.ValidString(reason) || utf8.RuneCountInString(reason) > 1000 {
		return nil, ErrInvoiceInvalidInput
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var invoice Invoice
		if err := lockForUpdate(tx).First(&invoice, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvoiceNotFound
			}
			return err
		}
		// Approval is final for the review step, but an approved request may
		// still be rejected if the issuer cannot issue the requested invoice.
		if invoice.Status != InvoiceStatusPending && !(invoice.Status == InvoiceStatusApproved && !approve) {
			return ErrInvoiceConflict
		}
		status := InvoiceStatusRejected
		if approve {
			status, reason = InvoiceStatusApproved, ""
		}
		now := common.GetTimestamp()
		result := tx.Model(&Invoice{}).Where("id = ? AND status = ?", id, invoice.Status).Updates(map[string]any{
			"status": status, "rejection_reason": reason, "reviewed_by": adminID, "reviewed_at": now, "updated_at": now,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrInvoiceConflict
		}
		if !approve {
			return tx.Where("invoice_id = ?", id).Delete(&InvoiceOrderReservation{}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return GetInvoice(id, adminID, true)
}

func IssueInvoice(id, adminID int, number, fileName string, content []byte) (*Invoice, error) {
	number, fileName = strings.TrimSpace(number), strings.TrimSpace(fileName)
	if id <= 0 || adminID <= 0 || number == "" || !utf8.ValidString(number) || utf8.RuneCountInString(number) > 100 ||
		fileName == "" || !utf8.ValidString(fileName) || utf8.RuneCountInString(fileName) > 255 ||
		strings.ContainsAny(fileName, "/\\") || !strings.HasSuffix(strings.ToLower(fileName), ".pdf") ||
		len(content) > InvoiceMaxFileSize || !bytes.HasPrefix(content, []byte("%PDF-")) ||
		!bytes.HasSuffix(bytes.TrimSpace(content), []byte("%%EOF")) {
		return nil, ErrInvoiceInvalidInput
	}
	for _, character := range number + fileName {
		if unicode.IsControl(character) {
			return nil, ErrInvoiceInvalidInput
		}
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var invoice Invoice
		if err := lockForUpdate(tx).First(&invoice, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvoiceNotFound
			}
			return err
		}
		if invoice.Status != InvoiceStatusApproved {
			return ErrInvoiceConflict
		}
		file := InvoiceFile{InvoiceID: id, FileName: fileName, Content: InvoiceDocument(content)}
		if err := tx.Create(&file).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		result := tx.Model(&Invoice{}).Where("id = ? AND status = ?", id, InvoiceStatusApproved).Updates(map[string]any{
			"status": InvoiceStatusIssued, "invoice_number": number, "file_name": fileName, "file_size": len(content),
			"issued_by": adminID, "issued_at": now, "updated_at": now,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrInvoiceConflict
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return GetInvoice(id, adminID, true)
}

func GetInvoiceFile(id, userID int, admin bool) (*InvoiceFile, error) {
	invoice, err := GetInvoice(id, userID, admin)
	if err != nil {
		return nil, err
	}
	if invoice.Status != InvoiceStatusIssued {
		return nil, ErrInvoiceNotFound
	}
	var file InvoiceFile
	if err := DB.First(&file, "invoice_id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	return &file, nil
}
