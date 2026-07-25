"use client"

import { useTranslation } from "react-i18next"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
} from "@/components/ui/select"
import PhotoListEditor from "./PhotoListEditor"
import { PHOTO_WIDGET_STYLES, type PhotoWidgetConfig, type PhotoWidgetStyle } from "@/lib/content/blocks"

interface PhotoWidgetConfigEditorProps {
  config: PhotoWidgetConfig
  onChange: (config: PhotoWidgetConfig) => void
}

export default function PhotoWidgetConfigEditor({ config, onChange }: PhotoWidgetConfigEditorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5 max-w-xs">
        <Label>{t('admin.pages.widgetStyleLabel')}</Label>
        <Select
          value={config.style}
          onValueChange={(v) => v && onChange({ ...config, style: v as PhotoWidgetStyle })}
        >
          <SelectTrigger className="h-9">
            <SelectValue>{(v: string) => t(`admin.pages.widgetStyle.${v}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PHOTO_WIDGET_STYLES.map((style) => (
              <SelectItem key={style} value={style}>
                <SelectItemText>{t(`admin.pages.widgetStyle.${style}`)}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PhotoListEditor photos={config.photos} onChange={(photos) => onChange({ ...config, photos })} />
    </div>
  )
}
