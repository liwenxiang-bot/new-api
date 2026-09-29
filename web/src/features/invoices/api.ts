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
import { isAxiosError } from 'axios'

import type { ApiResponse } from '@/features/wallet/types'
import { api } from '@/lib/api'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import type {
  Invoice,
  InvoiceApplicationRequest,
  InvoiceOrder,
  InvoicePage,
  InvoiceStatus,
} from './types'

export async function getEligibleInvoiceOrders(
  page: number,
  pageSize: number
): Promise<InvoicePage<InvoiceOrder>> {
  const response = await api.get<ApiResponse<InvoicePage<InvoiceOrder>>>(
    '/api/invoice/eligible',
    {
      params: { p: page, page_size: pageSize },
    }
  )
  const result = requireServerSuccess(response.data)
  if (!result.data) throw createServerError(result)
  return result.data
}

export async function getInvoices(
  admin: boolean,
  page: number,
  pageSize: number,
  status: InvoiceStatus | ''
): Promise<InvoicePage<Invoice>> {
  const response = await api.get<ApiResponse<InvoicePage<Invoice>>>(
    `/api/invoice/${admin ? 'admin' : 'self'}`,
    {
      params: { p: page, page_size: pageSize, status: status || undefined },
    }
  )
  const result = requireServerSuccess(response.data)
  if (!result.data) throw createServerError(result)
  return result.data
}

export async function getInvoice(admin: boolean, id: number): Promise<Invoice> {
  const response = await api.get<ApiResponse<Invoice>>(
    `/api/invoice/${admin ? 'admin' : 'self'}/${id}`
  )
  const result = requireServerSuccess(response.data)
  if (!result.data) throw createServerError(result)
  return result.data
}

export async function createInvoice(
  values: InvoiceApplicationRequest
): Promise<void> {
  requireServerSuccess((await api.post('/api/invoice/self', values)).data)
}

export async function reviewInvoice(
  id: number,
  approve: boolean,
  reason: string
): Promise<void> {
  requireServerSuccess(
    (await api.post(`/api/invoice/admin/${id}/review`, { approve, reason }))
      .data
  )
}

export async function issueInvoice(
  id: number,
  file: File,
  invoiceNumber: string
): Promise<void> {
  const data = new FormData()
  data.append('file', file)
  data.append('invoice_number', invoiceNumber)
  requireServerSuccess(
    (await api.post(`/api/invoice/admin/${id}/issue`, data)).data
  )
}

export async function downloadInvoice(
  admin: boolean,
  id: number
): Promise<void> {
  let blob: Blob
  try {
    const response = await api.get<Blob>(
      `/api/invoice/${admin ? 'admin' : 'self'}/${id}/file`,
      { responseType: 'blob' }
    )
    blob = response.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      const body = error.response.data
      if (body.type.includes('json')) {
        const payload: unknown = JSON.parse(await body.text())
        throw createServerError(payload)
      }
    }
    throw error
  }
  if (blob.type.includes('json')) {
    const payload: unknown = JSON.parse(await blob.text())
    throw createServerError(payload)
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${id}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  // Keep the URL alive until the browser has picked up the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
