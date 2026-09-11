/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.mp3' {
  const src: string
  export default src
}

declare module '*.MP3' {
  const src: string
  export default src
}

declare module '*.bin' {
  const src: string
  export default src
}

declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}
