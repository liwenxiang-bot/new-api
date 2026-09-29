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
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

type InvoiceSettingsValues = {
  enabled: boolean
  minAmountCny: string
}

export function InvoiceSettingsSection(props: {
  defaultValues: { enabled: boolean; minAmountMinor: number }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const amountError = t(
    'Enter an amount from 0 to 10000000000 with up to 2 decimal places.'
  )
  const schema = z.object({
    enabled: z.boolean(),
    minAmountCny: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, amountError)
      .refine((value) => Number(value) <= 1e10, amountError),
  })
  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<InvoiceSettingsValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        enabled: props.defaultValues.enabled,
        minAmountCny: (props.defaultValues.minAmountMinor / 100).toFixed(2),
      },
      onSubmit: async (values, changedFields) => {
        if ('enabled' in changedFields) {
          await updateOption.mutateAsync({
            key: 'invoice_setting.enabled',
            value: String(values.enabled),
          })
        }
        if ('minAmountCny' in changedFields) {
          const [yuan, fen = ''] = values.minAmountCny.split('.')
          const minor = Number(yuan) * 100 + Number(fen.padEnd(2, '0'))
          await updateOption.mutateAsync({
            key: 'invoice_setting.min_amount_minor',
            value: String(minor),
          })
        }
      },
    })
  const saving = updateOption.isPending || isSubmitting

  return (
    <SettingsSection title={t('Invoice settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit} noValidate>
          <SettingsPageFormActions
            onSave={handleSubmit}
            onReset={handleReset}
            isSaving={saving}
            isSaveDisabled={!isDirty}
            isResetDisabled={!isDirty}
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable invoice applications')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to apply for invoices. Disabling this hides the user entry and stops new applications; existing invoices remain accessible and can still be processed.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={saving}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <FormField
            control={form.control}
            name='minAmountCny'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Minimum invoice amount (CNY)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    inputMode='decimal'
                    min='0'
                    max='10000000000'
                    step='0.01'
                    disabled={saving}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Minimum total paid amount per invoice application. Set to 0 to remove the minimum. Changes apply to new applications.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
