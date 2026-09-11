import type { AppearanceConfig } from './appearance'

export interface ThemeEntry {
  label: string
  folder: string
}

export interface ThemeConfig {
  activeTheme: string
  themes: Record<string, ThemeEntry>
}

export interface ThemeOption {
  id: string
  label: string
}

export interface CreateThemePayload {
  id: string
  label: string
  basePath: string
  characterPath: string
  appearance: AppearanceConfig
}

export interface ThemeDetail {
  id: string
  label: string
  basePath: string
  characterPath: string
  appearance: AppearanceConfig
}

export interface CreateThemeResult {
  theme: ThemeOption
  config: ThemeConfig
}

export interface DeleteThemeResult {
  deletedId: string
  config: ThemeConfig
  appearance: AppearanceConfig | null
  switched: boolean
}

export const THEME_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/
