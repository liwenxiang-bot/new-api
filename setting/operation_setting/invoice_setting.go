package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type InvoiceSetting struct {
	Enabled        bool  `json:"enabled"`
	MinAmountMinor int64 `json:"min_amount_minor"`
}

// Preserve the existing invoice service until an administrator disables it.
var invoiceSetting = InvoiceSetting{Enabled: true, MinAmountMinor: 50000}

func init() {
	config.GlobalConfig.Register("invoice_setting", &invoiceSetting)
}

func IsInvoiceEnabled() bool {
	return InvoiceSettingsSnapshot().Enabled
}

func InvoiceSettingsSnapshot() InvoiceSetting {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return invoiceSetting
}
