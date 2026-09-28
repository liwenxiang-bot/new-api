package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAffiliateRewardHistory(c *gin.Context) {
	page := common.GetPageQuery(c)
	page.PageSize = max(1, page.PageSize)
	page.Page = min(max(1, page.Page), int(^uint(0)>>1)/page.PageSize)
	items, total, err := model.GetAffiliateRewardHistory(c.GetInt("id"), page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page.SetItems(items)
	page.SetTotal(int(total))
	common.ApiSuccess(c, page)
}
