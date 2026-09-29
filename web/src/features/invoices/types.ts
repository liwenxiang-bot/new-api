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
export type InvoiceStatus = 'pending' | 'approved' | 'rejected' | 'issued'

export interface InvoiceOrder {
  top_up_id: number
  trade_no: string
  payment_method: string
  payment_provider: string
  amount_minor: number
  currency: 'CNY'
  paid_at: number
}

export interface InvoiceApplicationRequest {
  top_up_ids: number[]
  invoice_type: 'ordinary'
  title_type: 'personal' | 'company'
  title: string
  tax_id: string
  email: string
  address: string
  phone: string
  bank_name: string
  bank_account: string
  remark: string
}

export interface Invoice extends Omit<
  InvoiceApplicationRequest,
  'top_up_ids' | 'invoice_type'
> {
  invoice_type: 'ordinary' | 'special'
  id: number
  user_id: number
  status: InvoiceStatus
  amount_minor: number
  currency: 'CNY'
  rejection_reason: string
  reviewed_by: number
  reviewed_at: number
  issued_by: number
  issued_at: number
  created_at: number
  updated_at: number
  invoice_number: string
  file_name: string
  file_size: number
  orders?: InvoiceOrder[]
}

export interface InvoicePage<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}
