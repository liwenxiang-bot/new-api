package model_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/router"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// The public startup path is exercised, including its production dialectors.
// SQL DSNs must point at dedicated empty databases; never reuse application data.
func invoiceTestDatabase(t *testing.T, dialect, scenario string) *gorm.DB {
	t.Helper()
	previousInvoiceSettings := operation_setting.InvoiceSettingsSnapshot()
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	settingsErr := config.UpdateConfigFromMap(config.GlobalConfig.Get("invoice_setting"), map[string]string{"enabled": "true", "min_amount_minor": "0"})
	common.OptionMapRWMutex.Unlock()
	require.NoError(t, settingsErr)
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		common.OptionMap = previousOptions
		assert.NoError(t, config.UpdateConfigFromMap(config.GlobalConfig.Get("invoice_setting"), map[string]string{
			"enabled":          strconv.FormatBool(previousInvoiceSettings.Enabled),
			"min_amount_minor": strconv.FormatInt(previousInvoiceSettings.MinAmountMinor, 10),
		}))
	})
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousPath, previousMaster := common.SQLitePath, common.IsMasterNode
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousType, previousLogType)
		common.SQLitePath, common.IsMasterNode = previousPath, previousMaster
	})
	var dsn string
	switch dialect {
	case "sqlite":
		dsn = "local"
		common.SQLitePath = filepath.Join(t.TempDir(), "invoice.db") + "?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate"
	case "mysql":
		dsn = os.Getenv("TEST_MYSQL_DSN")
	case "postgres":
		dsn = os.Getenv("TEST_POSTGRES_DSN")
	default:
		t.Fatalf("unsupported invoice test dialect %s", dialect)
	}
	if dsn == "" {
		t.Skip("dedicated test database DSN is not configured")
	}
	t.Setenv("SQL_DSN", dsn)
	t.Setenv("LOG_SQL_DSN", "")
	t.Setenv("SQL_MAX_OPEN_CONNS", "4")
	t.Setenv("SQL_MAX_IDLE_CONNS", "4")
	common.IsMasterNode = false
	require.NoError(t, model.InitDB())
	db := model.DB
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	tables, err := db.Migrator().GetTables()
	require.NoError(t, err)
	require.Empty(t, tables, "invoice tests require a dedicated empty database")
	cleanupDB := db
	t.Cleanup(func() {
		allTables, err := cleanupDB.Migrator().GetTables()
		require.NoError(t, err)
		for _, table := range allTables {
			if dialect == "sqlite" && strings.HasPrefix(table, "sqlite_") {
				continue
			}
			require.NoError(t, cleanupDB.Migrator().DropTable(table))
		}
	})
	if scenario == "upgrade" {
		// User and TopUp field definitions/tags are identical to release
		// v1.0.0-rc.40 (0aec08fee811ec6136828fda790551b49e410301).
		// That release has no invoice tables. Preserve a real paid order,
		// user balance, and existing uniqueness constraints while upgrading.
		require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}))
		invoiceTestUser(t, 701)
		invoiceTestTopUp(t, 701, "RELEASED-PAID-ORDER", 42.75)
	}
	common.IsMasterNode = true
	require.NoError(t, model.InitDB())
	db = model.DB
	secondSQLDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, secondSQLDB.Close()) })
	versionQuery := "SELECT version()"
	if dialect == "sqlite" {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
	t.Logf("%s %s database version: %s", dialect, scenario, version)
	return db
}

func invoiceTestUser(t *testing.T, id int) model.User {
	t.Helper()
	user := model.User{
		Id: id, Username: fmt.Sprintf("invoice-user-%d", id), Password: "test-hash", AuthVersion: 1,
		AffCode: fmt.Sprintf("invoice-aff-%d", id), Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
		Quota: 123456, UsedQuota: 789, AffQuota: 10, AffHistoryQuota: 20, CreatedAt: 1_700_000_000,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	return user
}

func invoiceTestTopUp(t *testing.T, userID int, tradeNo string, money float64) model.TopUp {
	t.Helper()
	order := model.TopUp{
		UserId: userID, Amount: 9999, Money: money, TradeNo: tradeNo,
		PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusSuccess,
		CreateTime: 1_700_000_000, CompleteTime: 1_700_000_010,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	return order
}

func invoiceTestRequest(ids ...int) model.InvoiceApplicationRequest {
	return model.InvoiceApplicationRequest{
		TopUpIDs: ids,
		InvoiceDetails: model.InvoiceDetails{
			InvoiceType: "ordinary", TitleType: "company", Title: "发票测试公司",
			TaxID: "913100001234567890", Email: "invoice@example.com", Remark: "充值开票",
		},
	}
}

type invoiceMigrationRecorder struct {
	logger.Interface
	mutations []string
}

func (r *invoiceMigrationRecorder) Trace(_ context.Context, _ time.Time, query func() (string, int64), _ error) {
	sql, _ := query()
	upper := strings.ToUpper(strings.TrimSpace(sql))
	if strings.HasPrefix(upper, "CREATE ") || strings.HasPrefix(upper, "ALTER ") || strings.HasPrefix(upper, "DROP ") {
		r.mutations = append(r.mutations, sql)
	}
}

func TestInvoiceDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		for _, scenario := range []string{"fresh", "upgrade"} {
			t.Run(dialect+"/"+scenario, func(t *testing.T) {
				db := invoiceTestDatabase(t, dialect, scenario)
				owner := invoiceTestUser(t, 101)
				other := invoiceTestUser(t, 102)
				first := invoiceTestTopUp(t, owner.Id, "INVOICE-FIRST", 1.005)
				second := invoiceTestTopUp(t, owner.Id, "INVOICE-SECOND", 2.375)
				foreign := invoiceTestTopUp(t, other.Id, "INVOICE-FOREIGN", 30)
				ineligible := []model.TopUp{}
				for _, provider := range []string{"", model.PaymentProviderStripe, model.PaymentProviderCreem, model.PaymentProviderWaffo, model.PaymentProviderWaffoPancake, model.PaymentProviderBalance} {
					order := invoiceTestTopUp(t, owner.Id, "INVOICE-PROVIDER-"+provider, 10)
					require.NoError(t, db.Model(&order).Update("payment_provider", provider).Error)
					ineligible = append(ineligible, order)
				}
				for _, change := range []struct {
					field string
					value any
				}{
					{"status", common.TopUpStatusPending}, {"amount", int64(0)}, {"money", 0.0},
					{"money", -1.0}, {"money", float64(model.InvoiceMaxAmountMinor)}, {"complete_time", int64(0)},
					{"payment_method", model.PaymentMethodBalance},
				} {
					order := invoiceTestTopUp(t, owner.Id, fmt.Sprintf("INVOICE-INELIGIBLE-%d", len(ineligible)), 10)
					require.NoError(t, db.Model(&order).Update(change.field, change.value).Error)
					ineligible = append(ineligible, order)
				}

				page := &common.PageInfo{Page: 1, PageSize: 100}
				eligible, total, err := model.ListInvoiceEligibleTopUps(owner.Id, page)
				require.NoError(t, err)
				assert.EqualValues(t, 2, total)
				require.Len(t, eligible, 2)
				assert.Equal(t, second.Id, eligible[0].TopUpID)
				assert.EqualValues(t, 238, eligible[0].AmountMinor)
				assert.EqualValues(t, 100, eligible[1].AmountMinor, "match the 2-digit amount sent to Epay, not quota or decimal re-rounding")
				for _, order := range ineligible {
					_, err := model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(order.Id))
					assert.ErrorIs(t, err, model.ErrInvoiceIneligible)
				}
				_, err = model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(first.Id, foreign.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceIneligible, "orders from another user must not be reserved")
				_, err = model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(first.Id, first.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
				var count int64
				require.NoError(t, db.Model(&model.Invoice{}).Count(&count).Error)
				assert.Zero(t, count, "failed applications are atomic")

				invoice, err := model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(second.Id, first.Id))
				require.NoError(t, err)
				assert.Equal(t, model.InvoiceStatusPending, invoice.Status)
				assert.Equal(t, "CNY", invoice.Currency)
				assert.EqualValues(t, 338, invoice.AmountMinor)
				require.Len(t, invoice.Orders, 2)
				assert.Equal(t, first.Id, invoice.Orders[0].TopUpID)
				_, err = model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(first.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				assert.Error(t, db.Create(&model.InvoiceOrderReservation{TopUpID: first.Id, InvoiceID: invoice.Id + 1}).Error, "database uniqueness prevents duplicate reservation")
				eligible, total, err = model.ListInvoiceEligibleTopUps(owner.Id, page)
				require.NoError(t, err)
				assert.Zero(t, total)
				assert.Empty(t, eligible)
				_, err = model.GetInvoice(invoice.Id, other.Id, false)
				assert.ErrorIs(t, err, model.ErrInvoiceNotFound)
				items, total, err := model.ListInvoices(other.Id, false, "", page)
				require.NoError(t, err)
				assert.Zero(t, total)
				assert.Empty(t, items)
				items, total, err = model.ListInvoices(other.Id, true, model.InvoiceStatusPending, page)
				require.NoError(t, err)
				assert.EqualValues(t, 1, total)
				require.Len(t, items, 1)
				assert.Empty(t, items[0].Orders, "lists do not fetch order histories or attachment bytes")

				pdf := []byte("%PDF-1.7\ninvoice test\n%%EOF\n")
				_, err = model.IssueInvoice(invoice.Id, 999, "INV-001", "invoice.pdf", pdf)
				assert.ErrorIs(t, err, model.ErrInvoiceConflict, "pending applications cannot be issued")
				_, err = model.GetInvoiceFile(invoice.Id, owner.Id, false)
				assert.ErrorIs(t, err, model.ErrInvoiceNotFound)
				approved, err := model.ReviewInvoice(invoice.Id, 999, true, "")
				require.NoError(t, err)
				assert.Equal(t, model.InvoiceStatusApproved, approved.Status)
				_, err = model.ReviewInvoice(invoice.Id, 999, true, "")
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				for _, invalidFile := range []struct {
					name string
					body []byte
				}{
					{"invoice.pdf", []byte("<html>not a PDF</html>")}, {"invoice.html", pdf},
					{"../invoice.pdf", pdf}, {"invoice\n.pdf", pdf}, {"invoice.pdf", []byte("%PDF-1.7 truncated")},
					{"invoice.pdf", append(bytes.Repeat([]byte{' '}, model.InvoiceMaxFileSize), pdf...)},
				} {
					_, err := model.IssueInvoice(invoice.Id, 999, "INV-001", invalidFile.name, invalidFile.body)
					assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
				}
				require.NoError(t, db.Model(&model.InvoiceFile{}).Count(&count).Error)
				assert.Zero(t, count, "invalid uploads must not persist files")
				largePDF := bytes.Repeat([]byte{' '}, model.InvoiceMaxFileSize)
				copy(largePDF, []byte("%PDF-1.7\n"))
				copy(largePDF[len(largePDF)-6:], []byte("%%EOF\n"))
				issued, err := model.IssueInvoice(invoice.Id, 999, "INV-001", "电子发票.pdf", largePDF)
				require.NoError(t, err, "the maximum supported PDF must fit every database")
				assert.Equal(t, model.InvoiceStatusIssued, issued.Status)
				assert.Equal(t, model.InvoiceMaxFileSize, issued.FileSize)
				file, err := model.GetInvoiceFile(invoice.Id, owner.Id, false)
				require.NoError(t, err)
				assert.Equal(t, largePDF, []byte(file.Content))
				_, err = model.GetInvoiceFile(invoice.Id, other.Id, false)
				assert.ErrorIs(t, err, model.ErrInvoiceNotFound)
				_, err = model.GetInvoiceFile(invoice.Id, other.Id, true)
				require.NoError(t, err)
				_, err = model.ReviewInvoice(invoice.Id, 999, false, "attempt to release issued orders")
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				_, err = model.IssueInvoice(invoice.Id, 999, "INV-REPLACEMENT", "replacement.pdf", pdf)
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				_, err = model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(first.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				require.NoError(t, db.Model(&first).Update("money", 500).Error)
				unchanged, err := model.GetInvoice(invoice.Id, owner.Id, false)
				require.NoError(t, err)
				assert.Equal(t, issued, unchanged, "source orders or current display settings must not rewrite invoice snapshots")

				rejectOrder := invoiceTestTopUp(t, owner.Id, "INVOICE-REJECT", 5)
				rejected, err := model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(rejectOrder.Id))
				require.NoError(t, err)
				_, err = model.ReviewInvoice(rejected.Id, 999, false, " ")
				assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
				rejected, err = model.ReviewInvoice(rejected.Id, 999, false, "请核对抬头")
				require.NoError(t, err)
				assert.Equal(t, model.InvoiceStatusRejected, rejected.Status)
				assert.Equal(t, "请核对抬头", rejected.RejectionReason)
				_, err = model.ReviewInvoice(rejected.Id, 999, true, "")
				assert.ErrorIs(t, err, model.ErrInvoiceConflict)
				reapplied, err := model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(rejectOrder.Id))
				require.NoError(t, err)
				assert.NotEqual(t, rejected.Id, reapplied.Id)
				savedRejection, err := model.GetInvoice(rejected.Id, owner.Id, false)
				require.NoError(t, err)
				assert.Equal(t, rejected, savedRejection, "reapplication preserves rejected history")
				_, err = model.ReviewInvoice(reapplied.Id, 999, true, "")
				require.NoError(t, err)
				_, err = model.ReviewInvoice(reapplied.Id, 999, false, "无法开具")
				require.NoError(t, err, "approved but unissued applications can release their orders")

				concurrentOrder := invoiceTestTopUp(t, owner.Id, "INVOICE-CONCURRENT", 10)
				start := make(chan struct{})
				results := make(chan error, 2)
				for range 2 {
					go func() {
						<-start
						_, err := model.CreateInvoiceApplication(owner.Id, invoiceTestRequest(concurrentOrder.Id))
						results <- err
					}()
				}
				close(start)
				errors := []error{<-results, <-results}
				successes := 0
				for _, err := range errors {
					if err == nil {
						successes++
					} else {
						assert.ErrorIs(t, err, model.ErrInvoiceConflict)
					}
				}
				assert.Equal(t, 1, successes, "only one concurrent application may own an order: %v", errors)
				var reservation model.InvoiceOrderReservation
				require.NoError(t, db.First(&reservation, "top_up_id = ?", concurrentOrder.Id).Error)
				_, err = model.ReviewInvoice(reservation.InvoiceID, 999, true, "")
				require.NoError(t, err)
				start = make(chan struct{})
				go func() {
					<-start
					_, err := model.IssueInvoice(reservation.InvoiceID, 999, "INV-CONCURRENT", "invoice.pdf", pdf)
					results <- err
				}()
				go func() {
					<-start
					_, err := model.ReviewInvoice(reservation.InvoiceID, 999, false, "concurrent rejection")
					results <- err
				}()
				close(start)
				errors = []error{<-results, <-results}
				successes = 0
				for _, err := range errors {
					if err == nil {
						successes++
					} else {
						assert.ErrorIs(t, err, model.ErrInvoiceConflict)
					}
				}
				assert.Equal(t, 1, successes, "issue and rejection cannot both commit: %v", errors)
				winner, err := model.GetInvoice(reservation.InvoiceID, owner.Id, false)
				require.NoError(t, err)
				require.NoError(t, db.Model(&model.InvoiceOrderReservation{}).Where("top_up_id = ?", concurrentOrder.Id).Count(&count).Error)
				if winner.Status == model.InvoiceStatusIssued {
					assert.EqualValues(t, 1, count)
					_, err = model.GetInvoiceFile(winner.Id, owner.Id, false)
					require.NoError(t, err)
				} else {
					assert.Equal(t, model.InvoiceStatusRejected, winner.Status)
					assert.Zero(t, count)
					_, err = model.GetInvoiceFile(winner.Id, owner.Id, false)
					assert.ErrorIs(t, err, model.ErrInvoiceNotFound)
				}

				boundaryOrder := invoiceTestTopUp(t, other.Id, "INVOICE-MAXIMUM", float64(model.InvoiceMaxAmountMinor)/100)
				_, err = model.CreateInvoiceApplication(other.Id, invoiceTestRequest(boundaryOrder.Id, foreign.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput, "combined amounts above the exact-money bound must be rejected atomically")
				boundaryInvoice, err := model.CreateInvoiceApplication(other.Id, invoiceTestRequest(boundaryOrder.Id))
				require.NoError(t, err)
				assert.Equal(t, model.InvoiceMaxAmountMinor, boundaryInvoice.AmountMinor)
				_, err = model.GetInvoice(0, owner.Id, false)
				assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
				_, err = model.GetInvoice(invoice.Id, 0, true)
				assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput, "zero user ID must never grant administrator scope")
				_, err = model.GetInvoice(math.MaxInt32, owner.Id, false)
				assert.ErrorIs(t, err, model.ErrInvoiceNotFound)

				// The minimum is based on selected paid orders, in exact fen, and
				// failed attempts leave both applications and reservations untouched.
				thresholdUser := invoiceTestUser(t, 103)
				require.NoError(t, model.UpdateOption("invoice_setting.min_amount_minor", "50000"))
				partA := invoiceTestTopUp(t, thresholdUser.Id, "MINIMUM-PART-A", 200)
				partB := invoiceTestTopUp(t, thresholdUser.Id, "MINIMUM-PART-B", 299.99)
				partC := invoiceTestTopUp(t, thresholdUser.Id, "MINIMUM-PART-C", 0.01)
				_, err = model.CreateInvoiceApplication(thresholdUser.Id, invoiceTestRequest(partA.Id, partB.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceBelowMinimum)
				require.NoError(t, db.Model(&model.Invoice{}).Where("user_id = ?", thresholdUser.Id).Count(&count).Error)
				assert.Zero(t, count)
				_, eligibleCount, err := model.ListInvoiceEligibleTopUps(thresholdUser.Id, page)
				require.NoError(t, err)
				assert.EqualValues(t, 3, eligibleCount, "below-minimum orders remain eligible for a combined application")
				minimumInvoice, err := model.CreateInvoiceApplication(thresholdUser.Id, invoiceTestRequest(partA.Id, partB.Id, partC.Id))
				require.NoError(t, err)
				assert.EqualValues(t, 50000, minimumInvoice.AmountMinor)
				require.NoError(t, model.UpdateOption("invoice_setting.min_amount_minor", "80001"))
				nextOrder := invoiceTestTopUp(t, thresholdUser.Id, "MINIMUM-NEW-ORDER", 800)
				_, err = model.CreateInvoiceApplication(thresholdUser.Id, invoiceTestRequest(nextOrder.Id))
				assert.ErrorIs(t, err, model.ErrInvoiceBelowMinimum, "previously invoiced orders cannot satisfy a new application's minimum")
				_, err = model.ReviewInvoice(minimumInvoice.Id, other.Id, true, "")
				require.NoError(t, err, "raising the minimum does not block existing applications")
				_, err = model.IssueInvoice(minimumInvoice.Id, other.Id, "MINIMUM-EXISTING", "invoice.pdf", []byte("%PDF-1.7\nexisting invoice\n%%EOF\n"))
				require.NoError(t, err)
				require.NoError(t, model.UpdateOption("invoice_setting.min_amount_minor", "80000"))
				_, err = model.CreateInvoiceApplication(thresholdUser.Id, invoiceTestRequest(nextOrder.Id))
				require.NoError(t, err, "lowered minimum applies without restart")
				require.NoError(t, model.UpdateOption("invoice_setting.min_amount_minor", "0"))
				tinyOrder := invoiceTestTopUp(t, thresholdUser.Id, "MINIMUM-DISABLED", 0.01)
				_, err = model.CreateInvoiceApplication(thresholdUser.Id, invoiceTestRequest(tinyOrder.Id))
				require.NoError(t, err, "zero removes the minimum without removing order eligibility checks")
				var minimumOption model.Option
				require.NoError(t, db.Where(&model.Option{Key: "invoice_setting.min_amount_minor"}).First(&minimumOption).Error)
				assert.Equal(t, "0", minimumOption.Value)

				// Run actual startup again on populated tables, then verify that a
				// further invoice migration performs no DDL and preserves records.
				require.NoError(t, model.InitDB())
				reopenedDB, err := model.DB.DB()
				require.NoError(t, err)
				t.Cleanup(func() { assert.NoError(t, reopenedDB.Close()) })
				db = model.DB
				recorder := &invoiceMigrationRecorder{Interface: logger.Discard}
				require.NoError(t, db.Session(&gorm.Session{Logger: recorder}).AutoMigrate(&model.Invoice{}, &model.InvoiceOrder{}, &model.InvoiceOrderReservation{}, &model.InvoiceFile{}))
				assert.Empty(t, recorder.mutations, "repeated invoice migrations must be a schema no-op")
				file, err = model.GetInvoiceFile(invoice.Id, owner.Id, false)
				require.NoError(t, err)
				assert.Equal(t, largePDF, []byte(file.Content), "restart preserves attachment bytes")
				var savedOwner model.User
				require.NoError(t, db.First(&savedOwner, owner.Id).Error)
				assert.Equal(t, owner, savedOwner, "invoice workflows must not change user balances")
				duplicateOrder := second
				duplicateOrder.Id = 0
				assert.Error(t, db.Create(&duplicateOrder).Error, "trade number uniqueness survives migration")
				assert.Error(t, db.Create(&model.InvoiceOrderReservation{TopUpID: first.Id, InvoiceID: invoice.Id + 1}).Error, "reservation uniqueness survives migration")
				duplicateOwner := owner
				duplicateOwner.Id, duplicateOwner.AffCode = 0, "different-aff-code"
				assert.Error(t, db.Create(&duplicateOwner).Error, "username uniqueness survives migration")
				if scenario == "upgrade" {
					var historical model.TopUp
					require.NoError(t, db.First(&historical, "trade_no = ?", "RELEASED-PAID-ORDER").Error)
					assert.EqualValues(t, 42.75, historical.Money)
					assert.EqualValues(t, 9999, historical.Amount)
					assert.Equal(t, common.TopUpStatusSuccess, historical.Status)
					assert.Equal(t, model.PaymentProviderEpay, historical.PaymentProvider)
					var historicalUser model.User
					require.NoError(t, db.First(&historicalUser, 701).Error)
					assert.Equal(t, 123456, historicalUser.Quota)
					assert.Equal(t, 10, historicalUser.AffQuota)
				}
			})
		}
	}
}

func TestInvoiceInputValidation(t *testing.T) {
	for _, test := range []struct {
		name string
		edit func(*model.InvoiceApplicationRequest)
	}{
		{"no_orders", func(i *model.InvoiceApplicationRequest) { i.TopUpIDs = nil }},
		{"too_many_orders", func(i *model.InvoiceApplicationRequest) { i.TopUpIDs = make([]int, 101) }},
		{"negative_order", func(i *model.InvoiceApplicationRequest) { i.TopUpIDs = []int{-1} }},
		{"duplicate_order", func(i *model.InvoiceApplicationRequest) { i.TopUpIDs = []int{1, 1} }},
		{"missing_title", func(i *model.InvoiceApplicationRequest) { i.Title = " " }},
		{"long_title", func(i *model.InvoiceApplicationRequest) { i.Title = strings.Repeat("票", 201) }},
		{"missing_tax_id", func(i *model.InvoiceApplicationRequest) { i.TaxID = "" }},
		{"invalid_tax_id", func(i *model.InvoiceApplicationRequest) { i.TaxID = "91310000'234567890" }},
		{"unknown_type", func(i *model.InvoiceApplicationRequest) { i.InvoiceType = "refund" }},
		{"company_special_with_valid_details", func(i *model.InvoiceApplicationRequest) { i.InvoiceType = "special" }},
		{"personal_special", func(i *model.InvoiceApplicationRequest) {
			i.TitleType, i.InvoiceType, i.TaxID = "personal", "special", ""
		}},
		{"display_name_email", func(i *model.InvoiceApplicationRequest) { i.Email = "Owner <owner@example.com>" }},
		{"control_character", func(i *model.InvoiceApplicationRequest) { i.Title = "title\nheader" }},
		{"invalid_email", func(i *model.InvoiceApplicationRequest) { i.Email = "no-at-sign" }},
		{"long_remark", func(i *model.InvoiceApplicationRequest) { i.Remark = strings.Repeat("x", 1001) }},
	} {
		t.Run(test.name, func(t *testing.T) {
			input := invoiceTestRequest(1)
			test.edit(&input)
			assert.ErrorIs(t, input.Validate(), model.ErrInvoiceInvalidInput)
		})
	}
	personal := invoiceTestRequest(1)
	personal.TitleType, personal.InvoiceType, personal.TaxID = "personal", "ordinary", ""
	require.NoError(t, personal.Validate())
	company := invoiceTestRequest(1)
	company.InvoiceType, company.TaxID = "ordinary", "91310000abcdef7890"
	require.NoError(t, company.Validate())
	assert.Equal(t, "91310000ABCDEF7890", company.TaxID)
	for _, page := range []*common.PageInfo{
		nil, {Page: 0, PageSize: 10}, {Page: 1, PageSize: -1}, {Page: 1, PageSize: 101}, {Page: math.MaxInt, PageSize: 100},
	} {
		_, _, err := model.ListInvoices(1, false, "", page)
		assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
		_, _, err = model.ListInvoiceEligibleTopUps(1, page)
		assert.ErrorIs(t, err, model.ErrInvoiceInvalidInput)
	}
}

type invoiceHTTPActor struct {
	userID  int
	session *service.AuthBundle
}

type invoiceHTTPFixture struct {
	router *gin.Engine
	owner  invoiceHTTPActor
	other  invoiceHTTPActor
	admin  invoiceHTTPActor
}

func newInvoiceHTTPFixture(t *testing.T) invoiceHTTPFixture {
	t.Helper()
	previousGinMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousGinMode) })
	invoiceTestDatabase(t, "sqlite", "fresh")
	require.NoError(t, model.InitLogDB())
	require.NoError(t, i18n.Init())
	previousRedis, previousSecret := common.RedisEnabled, common.SessionSecret
	previousAPI, previousCritical := common.GlobalApiRateLimitEnable, common.CriticalRateLimitEnable
	previousActiveLimit, previousIssuanceLimit := common.UserSessionActiveLimit, common.UserSessionIssuanceLimit
	common.RedisEnabled, common.SessionSecret = false, "invoice-http-test-session-secret"
	common.GlobalApiRateLimitEnable, common.CriticalRateLimitEnable = false, false
	common.UserSessionActiveLimit, common.UserSessionIssuanceLimit = common.DefaultUserSessionActiveLimit, common.DefaultUserSessionIssuanceLimit
	t.Cleanup(func() {
		common.RedisEnabled, common.SessionSecret = previousRedis, previousSecret
		common.GlobalApiRateLimitEnable, common.CriticalRateLimitEnable = previousAPI, previousCritical
		common.UserSessionActiveLimit, common.UserSessionIssuanceLimit = previousActiveLimit, previousIssuanceLimit
	})
	fixture := invoiceHTTPFixture{router: gin.New()}
	for i, actor := range []*invoiceHTTPActor{&fixture.owner, &fixture.other, &fixture.admin} {
		user := invoiceTestUser(t, 801+i)
		if i == 2 {
			require.NoError(t, model.DB.Model(&user).Update("role", common.RoleAdminUser).Error)
		}
		session, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "invoice-http-test")
		require.NoError(t, err)
		*actor = invoiceHTTPActor{userID: user.Id, session: session}
	}
	router.SetApiRouter(fixture.router)
	return fixture
}

func invoiceHTTPRequest(t *testing.T, engine *gin.Engine, method, path, token, contentType string, body io.Reader) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, body)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

func invoiceHTTPUpload(t *testing.T, engine *gin.Engine, invoiceID int, token, filename string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("invoice_number", "INVOICE-HTTP-001"))
	part, err := writer.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	return invoiceHTTPRequest(t, engine, http.MethodPost, fmt.Sprintf("/api/invoice/admin/%d/issue", invoiceID), token, writer.FormDataContentType(), &body)
}

func TestInvoiceHTTPWorkflowAndOwnership(t *testing.T) {
	fixture := newInvoiceHTTPFixture(t)
	paid := invoiceTestTopUp(t, fixture.owner.userID, "HTTP-OWNER-PAID", 42.75)
	foreign := invoiceTestTopUp(t, fixture.other.userID, "HTTP-OTHER-PAID", 11)

	eligible := invoiceHTTPRequest(t, fixture.router, http.MethodGet, "/api/invoice/eligible", fixture.owner.session.AccessToken, "", nil)
	require.Equal(t, http.StatusOK, eligible.Code, eligible.Body.String())
	assert.Contains(t, eligible.Body.String(), paid.TradeNo)
	assert.NotContains(t, eligible.Body.String(), foreign.TradeNo)
	foreignBody, err := common.Marshal(invoiceTestRequest(foreign.Id))
	require.NoError(t, err)
	response := invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(foreignBody))
	assert.Equal(t, http.StatusBadRequest, response.Code)

	input := invoiceTestRequest(paid.Id)
	input.BankAccount = "sensitive-bank-account-123456"
	body, err := common.Marshal(input)
	require.NoError(t, err)
	// Fields belonging to the server must never be mass-assigned from the request.
	body = []byte(strings.TrimSuffix(string(body), "}") + fmt.Sprintf(`,"user_id":%d,"amount_minor":1,"status":"issued","currency":"USD"}`, fixture.other.userID))
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(body))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var created struct {
		Success bool          `json:"success"`
		Data    model.Invoice `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &created))
	require.True(t, created.Success)
	require.Positive(t, created.Data.Id)
	assert.Equal(t, fixture.owner.userID, created.Data.UserID)
	assert.EqualValues(t, 4275, created.Data.AmountMinor)
	assert.Equal(t, "CNY", created.Data.Currency)
	assert.Equal(t, model.InvoiceStatusPending, created.Data.Status)
	id := created.Data.Id
	selfPath := fmt.Sprintf("/api/invoice/self/%d", id)
	adminPath := fmt.Sprintf("/api/invoice/admin/%d", id)
	for _, check := range []struct {
		name, path, token string
		status            int
	}{
		{"owner detail", selfPath, fixture.owner.session.AccessToken, http.StatusOK},
		{"other detail", selfPath, fixture.other.session.AccessToken, http.StatusNotFound},
		{"admin detail", adminPath, fixture.admin.session.AccessToken, http.StatusOK},
		{"user cannot read admin detail", adminPath, fixture.owner.session.AccessToken, http.StatusForbidden},
		{"pending file unavailable", selfPath + "/file", fixture.owner.session.AccessToken, http.StatusNotFound},
	} {
		t.Run(check.name, func(t *testing.T) {
			got := invoiceHTTPRequest(t, fixture.router, http.MethodGet, check.path, check.token, "", nil)
			assert.Equal(t, check.status, got.Code, got.Body.String())
		})
	}
	for _, check := range []struct {
		name, path, token string
		total             int
	}{
		{"owner list", "/api/invoice/self", fixture.owner.session.AccessToken, 1},
		{"other list", "/api/invoice/self", fixture.other.session.AccessToken, 0},
		{"admin list", "/api/invoice/admin", fixture.admin.session.AccessToken, 1},
	} {
		t.Run(check.name, func(t *testing.T) {
			got := invoiceHTTPRequest(t, fixture.router, http.MethodGet, check.path, check.token, "", nil)
			require.Equal(t, http.StatusOK, got.Code, got.Body.String())
			var list struct {
				Data struct {
					Total int             `json:"total"`
					Items []model.Invoice `json:"items"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(got.Body.Bytes(), &list))
			assert.Equal(t, check.total, list.Data.Total)
			assert.Len(t, list.Data.Items, check.total)
		})
	}

	pdf := []byte("%PDF-1.7\ninvoice-private-content\n%%EOF\n")
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, adminPath+"/review", fixture.owner.session.AccessToken, "application/json", strings.NewReader(`{"approve":true}`))
	assert.Equal(t, http.StatusForbidden, response.Code)
	response = invoiceHTTPUpload(t, fixture.router, id, fixture.owner.session.AccessToken, "invoice.pdf", pdf)
	assert.Equal(t, http.StatusForbidden, response.Code)
	response = invoiceHTTPUpload(t, fixture.router, id, fixture.admin.session.AccessToken, "invoice.pdf", pdf)
	assert.Equal(t, http.StatusConflict, response.Code, "issuance requires prior review")
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, adminPath+"/review", fixture.admin.session.AccessToken, "application/json", strings.NewReader(`{"approve":true}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	response = invoiceHTTPUpload(t, fixture.router, id, fixture.admin.session.AccessToken, "invoice.pdf", pdf)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	for _, actor := range []struct{ name, path, token string }{
		{"owner", selfPath + "/file", fixture.owner.session.AccessToken},
		{"admin", adminPath + "/file", fixture.admin.session.AccessToken},
	} {
		t.Run(actor.name+" downloads exact bytes", func(t *testing.T) {
			got := invoiceHTTPRequest(t, fixture.router, http.MethodGet, actor.path, actor.token, "", nil)
			require.Equal(t, http.StatusOK, got.Code, got.Body.String())
			assert.Equal(t, pdf, got.Body.Bytes())
			assert.Equal(t, "application/pdf", got.Header().Get("Content-Type"))
			assert.Equal(t, fmt.Sprintf("attachment; filename=invoice-%d.pdf", id), got.Header().Get("Content-Disposition"))
			assert.Equal(t, "nosniff", got.Header().Get("X-Content-Type-Options"))
			assert.Contains(t, got.Header().Get("Cache-Control"), "no-store")
			assert.Contains(t, got.Header().Get("Content-Security-Policy"), "sandbox")
		})
	}
	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, selfPath+"/file", fixture.other.session.AccessToken, "", nil)
	assert.Equal(t, http.StatusNotFound, response.Code)
	assert.NotContains(t, response.Body.String(), "invoice-private-content")
	const ownerPAT = "invoice-http-test-owner-personal-access-token"
	require.NoError(t, model.UpdateUserAccessToken(fixture.owner.userID, ownerPAT))
	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, selfPath+"/file", ownerPAT, "", nil)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, pdf, response.Body.Bytes(), "personal access tokens retain owner-scoped downloads")
	response = invoiceHTTPUpload(t, fixture.router, id, fixture.admin.session.AccessToken, "invoice.pdf", pdf)
	assert.Equal(t, http.StatusConflict, response.Code)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, adminPath+"/review", fixture.admin.session.AccessToken, "application/json", strings.NewReader(`{"approve":false,"reason":"late rejection"}`))
	assert.Equal(t, http.StatusConflict, response.Code)

	var audits []model.AuditLog
	require.NoError(t, model.LOG_DB.Where("route LIKE ?", "/api/invoice/%").Find(&audits).Error)
	require.NotEmpty(t, audits, "admin writes must leave an audit trail")
	var successfulReview, successfulIssue bool
	for _, event := range audits {
		if event.Success && event.UserId == fixture.admin.userID && event.Status == http.StatusOK {
			successfulReview = successfulReview || event.Route == "/api/invoice/admin/:id/review"
			successfulIssue = successfulIssue || event.Route == "/api/invoice/admin/:id/issue"
		}
	}
	assert.True(t, successfulReview, "approval records the successful actor and operation")
	assert.True(t, successfulIssue, "issuance records the successful actor and operation")
	auditJSON, err := common.Marshal(audits)
	require.NoError(t, err)
	for _, sensitive := range []string{fixture.admin.session.AccessToken, fixture.owner.session.AccessToken, ownerPAT, input.Email, input.TaxID, input.BankAccount, "invoice-private-content"} {
		assert.NotContains(t, string(auditJSON), sensitive)
	}
}

func TestInvoiceHTTPRejectsInvalidCredentials(t *testing.T) {
	fixture := newInvoiceHTTPFixture(t)
	identity, err := service.ParseAccessToken(fixture.owner.session.AccessToken)
	require.NoError(t, err)
	expiredClaims := jwt.MapClaims{
		"iss": "new-api", "aud": []string{"new-api-dashboard"}, "sub": strconv.Itoa(identity.UserID),
		"token_use": "access", "sid": identity.SessionID, "uv": identity.UserAuthVersion, "sv": identity.SessionVersion,
		"exp": time.Now().Add(-time.Minute).Unix(), "nbf": time.Now().Add(-2 * time.Minute).Unix(), "iat": time.Now().Add(-2 * time.Minute).Unix(), "jti": "expired-invoice-test",
	}
	mac := hmac.New(sha256.New, []byte(common.SessionSecret))
	_, err = mac.Write([]byte("new-api/auth/access/v1"))
	require.NoError(t, err)
	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims).SignedString(mac.Sum(nil))
	require.NoError(t, err)
	for _, check := range []struct{ name, authorization, cookie, query string }{
		{name: "no credentials"},
		{name: "refresh cookie alone", cookie: fixture.owner.session.RefreshToken},
		{name: "query token ignored", query: "?access_token=" + url.QueryEscape(fixture.owner.session.AccessToken)},
		{name: "expired bearer", authorization: expired},
	} {
		t.Run(check.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/invoice/self"+check.query, nil)
			if check.authorization != "" {
				request.Header.Set("Authorization", "Bearer "+check.authorization)
			}
			if check.cookie != "" {
				request.AddCookie(&http.Cookie{Name: service.RefreshCookieName, Value: check.cookie})
			}
			response := httptest.NewRecorder()
			fixture.router.ServeHTTP(response, request)
			assert.Equal(t, http.StatusUnauthorized, response.Code, response.Body.String())
		})
	}
	revoked, err := model.RevokeUserSession(fixture.owner.userID, fixture.owner.session.Session.SID, "invoice-auth-test")
	require.NoError(t, err)
	require.True(t, revoked)
	response := invoiceHTTPRequest(t, fixture.router, http.MethodGet, "/api/invoice/self", fixture.owner.session.AccessToken, "", nil)
	assert.Equal(t, http.StatusUnauthorized, response.Code)
	assert.Contains(t, response.Body.String(), "AUTH_SESSION_REVOKED")
}

func TestInvoiceHTTPRejectsMalformedRequestsAndUploads(t *testing.T) {
	fixture := newInvoiceHTTPFixture(t)
	paid := invoiceTestTopUp(t, fixture.owner.userID, "HTTP-VALIDATION-PAID", 10)
	for _, check := range []struct {
		name, body, mediaType string
		status                int
	}{
		{"wrong content type", `{}`, "text/plain", http.StatusUnsupportedMediaType},
		{"malformed JSON", `{`, "application/json", http.StatusBadRequest},
		{"trailing JSON", `{} {}`, "application/json", http.StatusBadRequest},
		{"oversized JSON", strings.Repeat(" ", 33<<10), "application/json", http.StatusRequestEntityTooLarge},
	} {
		t.Run(check.name, func(t *testing.T) {
			response := invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, check.mediaType, strings.NewReader(check.body))
			assert.Equal(t, check.status, response.Code, response.Body.String())
		})
	}
	invoice, err := model.CreateInvoiceApplication(fixture.owner.userID, invoiceTestRequest(paid.Id))
	require.NoError(t, err)
	reviewPath := fmt.Sprintf("/api/invoice/admin/%d/review", invoice.Id)
	response := invoiceHTTPRequest(t, fixture.router, http.MethodPost, reviewPath, fixture.admin.session.AccessToken, "application/json", strings.NewReader(`{}`))
	assert.Equal(t, http.StatusBadRequest, response.Code, "omitted approve is not implicit rejection")
	_, err = model.ReviewInvoice(invoice.Id, fixture.admin.userID, true, "")
	require.NoError(t, err)
	for _, check := range []struct {
		name, filename string
		content        []byte
		status         int
	}{
		{"wrong extension", "invoice.html", []byte("%PDF-1.7\n%%EOF"), http.StatusBadRequest},
		{"spoofed extension", "invoice.pdf", []byte("<html>not a PDF</html>"), http.StatusBadRequest},
		{"missing EOF", "invoice.pdf", []byte("%PDF-1.7\ntruncated"), http.StatusBadRequest},
		{"oversized file", "invoice.pdf", bytes.Repeat([]byte("x"), model.InvoiceMaxFileSize+1), http.StatusRequestEntityTooLarge},
	} {
		t.Run(check.name, func(t *testing.T) {
			got := invoiceHTTPUpload(t, fixture.router, invoice.Id, fixture.admin.session.AccessToken, check.filename, check.content)
			assert.Equal(t, check.status, got.Code, got.Body.String())
		})
	}
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, fmt.Sprintf("/api/invoice/admin/%d/issue", invoice.Id), fixture.admin.session.AccessToken, "multipart/form-data; boundary=missing", strings.NewReader("broken"))
	assert.Equal(t, http.StatusBadRequest, response.Code)
	stored, err := model.GetInvoice(invoice.Id, fixture.owner.userID, false)
	require.NoError(t, err)
	assert.Equal(t, model.InvoiceStatusApproved, stored.Status, "invalid uploads never issue the application")
	var files int64
	require.NoError(t, model.DB.Model(&model.InvoiceFile{}).Count(&files).Error)
	assert.Zero(t, files)
}

func TestInvoiceHTTPApplicationSwitch(t *testing.T) {
	fixture := newInvoiceHTTPFixture(t)
	root := invoiceTestUser(t, 804)
	require.NoError(t, model.DB.Model(&root).Update("role", common.RoleRootUser).Error)
	rootSession, err := service.CreateLoginSession(root.Id, "password", "127.0.0.1", "invoice-http-test")
	require.NoError(t, err)
	paid := invoiceTestTopUp(t, fixture.owner.userID, "HTTP-SWITCH-EXISTING", 10)
	invoice, err := model.CreateInvoiceApplication(fixture.owner.userID, invoiceTestRequest(paid.Id))
	require.NoError(t, err)
	newPaid := invoiceTestTopUp(t, fixture.owner.userID, "HTTP-SWITCH-NEW", 20)
	body, err := common.Marshal(invoiceTestRequest(newPaid.Id))
	require.NoError(t, err)

	for _, token := range []string{fixture.owner.session.AccessToken, fixture.admin.session.AccessToken} {
		response := invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", token, "application/json", strings.NewReader(`{"key":"invoice_setting.enabled","value":false}`))
		assert.Equal(t, http.StatusForbidden, response.Code)
	}
	assert.True(t, operation_setting.IsInvoiceEnabled())
	response := invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", rootSession.AccessToken, "application/json", strings.NewReader(`{"key":"invoice_setting.enabled","value":false}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	require.Contains(t, response.Body.String(), `"success":true`)
	require.False(t, operation_setting.IsInvoiceEnabled())
	var saved model.Option
	require.NoError(t, model.DB.Where(&model.Option{Key: "invoice_setting.enabled"}).First(&saved).Error)
	assert.Equal(t, "false", saved.Value)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, "/api/status", "", "", nil)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"invoice_enabled":false`)

	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, "/api/invoice/eligible", fixture.owner.session.AccessToken, "", nil)
	assert.Equal(t, http.StatusForbidden, response.Code)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(body))
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), `"code":"INVOICE_DISABLED"`)
	var count int64
	require.NoError(t, model.DB.Model(&model.Invoice{}).Count(&count).Error)
	assert.EqualValues(t, 1, count, "disabled requests create no application")
	require.NoError(t, model.DB.Model(&model.InvoiceOrderReservation{}).Where("top_up_id = ?", newPaid.Id).Count(&count).Error)
	assert.Zero(t, count, "disabled requests never reserve orders")

	selfPath := fmt.Sprintf("/api/invoice/self/%d", invoice.Id)
	adminPath := fmt.Sprintf("/api/invoice/admin/%d", invoice.Id)
	for _, path := range []string{"/api/invoice/self", selfPath} {
		response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, path, fixture.owner.session.AccessToken, "", nil)
		assert.Equal(t, http.StatusOK, response.Code, "existing history remains available")
	}
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, adminPath+"/review", fixture.admin.session.AccessToken, "application/json", strings.NewReader(`{"approve":true}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	pdf := []byte("%PDF-1.7\nexisting-invoice\n%%EOF\n")
	response = invoiceHTTPUpload(t, fixture.router, invoice.Id, fixture.admin.session.AccessToken, "invoice.pdf", pdf)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, selfPath+"/file", fixture.owner.session.AccessToken, "", nil)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, pdf, response.Body.Bytes())

	response = invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", rootSession.AccessToken, "application/json", strings.NewReader(`{"key":"invoice_setting.enabled","value":"invalid"}`))
	assert.Contains(t, response.Body.String(), `"success":false`)
	assert.False(t, operation_setting.IsInvoiceEnabled())
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", rootSession.AccessToken, "application/json", strings.NewReader(`{"key":"invoice_setting.enabled","value":true}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	require.True(t, operation_setting.IsInvoiceEnabled())
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(body))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"success":true`)
}

func TestInvoiceHTTPMinimumAmount(t *testing.T) {
	fixture := newInvoiceHTTPFixture(t)
	root := invoiceTestUser(t, 804)
	require.NoError(t, model.DB.Model(&root).Update("role", common.RoleRootUser).Error)
	session, err := service.CreateLoginSession(root.Id, "password", "127.0.0.1", "invoice-http-test")
	require.NoError(t, err)
	for _, token := range []string{fixture.owner.session.AccessToken, fixture.admin.session.AccessToken} {
		response := invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", token, "application/json", strings.NewReader(`{"key":"invoice_setting.min_amount_minor","value":"50000"}`))
		assert.Equal(t, http.StatusForbidden, response.Code)
	}
	response := invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", session.AccessToken, "application/json", strings.NewReader(`{"key":"invoice_setting.min_amount_minor","value":"50000"}`))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	require.Contains(t, response.Body.String(), `"success":true`)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodGet, "/api/status", "", "", nil)
	assert.Contains(t, response.Body.String(), `"invoice_min_amount_minor":50000`)
	for _, value := range []string{"-1", "1.5", "invalid", "1000000000001", "9223372036854775808"} {
		input, err := common.Marshal(map[string]string{"key": "invoice_setting.min_amount_minor", "value": value})
		require.NoError(t, err)
		response = invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", session.AccessToken, "application/json", bytes.NewReader(input))
		assert.Contains(t, response.Body.String(), `"success":false`, value)
		assert.EqualValues(t, 50000, operation_setting.InvoiceSettingsSnapshot().MinAmountMinor)
	}
	paid := invoiceTestTopUp(t, fixture.owner.userID, "HTTP-MINIMUM", 499.99)
	body, err := common.Marshal(invoiceTestRequest(paid.Id))
	require.NoError(t, err)
	body = []byte(strings.TrimSuffix(string(body), "}") + `,"amount_minor":50000,"min_amount_minor":0}`)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(body))
	require.Equal(t, http.StatusBadRequest, response.Code)
	assert.Contains(t, response.Body.String(), `"code":"INVOICE_BELOW_MINIMUM"`)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPut, "/api/option/", session.AccessToken, "application/json", strings.NewReader(`{"key":"invoice_setting.min_amount_minor","value":"49999"}`))
	require.Contains(t, response.Body.String(), `"success":true`)
	response = invoiceHTTPRequest(t, fixture.router, http.MethodPost, "/api/invoice/self", fixture.owner.session.AccessToken, "application/json", bytes.NewReader(body))
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Contains(t, response.Body.String(), `"amount_minor":49999`)
}
