/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { InvoiceApplicationRequest } from '../types'

export type InvoiceDetailField =
  | 'title'
  | 'tax_id'
  | 'address'
  | 'phone'
  | 'bank_name'
  | 'bank_account'
  | 'email'

const fieldLabels: Record<string, InvoiceDetailField> = {
  单位名称: 'title',
  公司名称: 'title',
  企业名称: 'title',
  发票抬头: 'title',
  抬头: 'title',
  companyname: 'title',
  invoicetitle: 'title',
  纳税人识别号: 'tax_id',
  纳税识别号: 'tax_id',
  税号: 'tax_id',
  统一社会信用代码: 'tax_id',
  taxpayerid: 'tax_id',
  taxid: 'tax_id',
  地址: 'address',
  注册地址: 'address',
  单位地址: 'address',
  公司地址: 'address',
  address: 'address',
  registeredaddress: 'address',
  联系电话: 'phone',
  电话: 'phone',
  手机号码: 'phone',
  phone: 'phone',
  contactphone: 'phone',
  开户银行: 'bank_name',
  开户行: 'bank_name',
  银行名称: 'bank_name',
  bankname: 'bank_name',
  账号: 'bank_account',
  帐号: 'bank_account',
  银行账号: 'bank_account',
  银行帐号: 'bank_account',
  开户账号: 'bank_account',
  开户帐号: 'bank_account',
  bankaccount: 'bank_account',
  accountnumber: 'bank_account',
  邮箱: 'email',
  电子邮箱: 'email',
  联系邮箱: 'email',
  email: 'email',
  contactemail: 'email',
}
const companyTitleLabels = new Set([
  '单位名称',
  '公司名称',
  '企业名称',
  'companyname',
])

export function parseInvoiceDetails(text: string): {
  fields: Partial<Pick<InvoiceApplicationRequest, InvoiceDetailField>>
  company: boolean
} {
  const fields: Partial<Pick<InvoiceApplicationRequest, InvoiceDetailField>> =
    {}
  let company = false

  for (const line of text.split(/\r\n?|\n/)) {
    // Anchor labels to the line start so words inside an address or bank name
    // cannot be mistaken for another field.
    const match = line.match(/^\s*([^:：]+?)\s*[:：]\s*(.*?)\s*$/u)
    if (!match) continue
    const label = match[1].replaceAll(/\s+/g, '').toLowerCase()
    if (!Object.hasOwn(fieldLabels, label)) continue
    const field = fieldLabels[label]
    let value = match[2].trim()
    if (field === 'tax_id' || field === 'bank_account') {
      value = value.replaceAll(/\s+/g, '')
    }
    if (!value) continue
    if (field === 'tax_id') value = value.toUpperCase()
    fields[field] = value
    if (field === 'tax_id' || companyTitleLabels.has(label)) company = true
  }

  return { fields, company }
}
